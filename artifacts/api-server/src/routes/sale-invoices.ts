import { Router } from "express";
import { db } from "@workspace/db";
import {
  saleInvoicesTable, saleInvoiceItemsTable, saleInvoicePaymentsTable, stockTransactionsTable,
  ordersTable,
} from "@workspace/db/schema";
import { adjustStock, adjustReservedStock } from "../lib/batch-stock";
import { partiesTable } from "@workspace/db/schema";
import { eq, and, ilike, gte, lte, sql, ne } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeInvoiceNumber } from "../lib/counter";
import { companySettingsTable } from "@workspace/db/schema";

async function checkCreditLimit(partyId: number, newBalanceDue: number, excludeInvoiceId?: number): Promise<string | null> {
  const [party] = await db.select().from(partiesTable).where(eq(partiesTable.id, partyId)).limit(1);
  if (!party || party.creditLimitEnabled !== "true" || !party.creditLimit) return null;

  const limit = Number(party.creditLimit);
  if (limit <= 0) return null;

  const conditions: any[] = [
    eq(saleInvoicesTable.partyId, partyId),
    eq(saleInvoicesTable.isDeleted, "false"),
  ];
  if (excludeInvoiceId) conditions.push(ne(saleInvoicesTable.id, excludeInvoiceId));

  const rows = await db.select({ balanceDue: saleInvoicesTable.balanceDue })
    .from(saleInvoicesTable)
    .where(and(...conditions));

  const outstanding = rows.reduce((sum, r) => sum + Number(r.balanceDue), 0);
  const projected = outstanding + newBalanceDue;

  if (projected > limit) {
    return `Credit limit of ₹${limit.toLocaleString("en-IN")} reached. Current outstanding: ₹${outstanding.toLocaleString("en-IN")}. This invoice would take it to ₹${projected.toLocaleString("en-IN")}.`;
  }
  return null;
}

const router = Router();

router.get("/sale-invoices", authMiddleware, async (req, res) => {
  const { search, from, to, status, partyId } = req.query;
  const conditions: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
  if (search) conditions.push(ilike(saleInvoicesTable.partyName, `%${search}%`));
  if (from) conditions.push(gte(saleInvoicesTable.date, from as string));
  if (to) conditions.push(lte(saleInvoicesTable.date, to as string));
  if (status) conditions.push(eq(saleInvoicesTable.status, status as string));
  if (partyId) conditions.push(eq(saleInvoicesTable.partyId, Number(partyId)));

  const invoices = await db.select().from(saleInvoicesTable)
    .where(and(...conditions))
    .orderBy(sql`date DESC, created_at DESC`);

  res.json(invoices.map(i => ({
    ...i,
    subtotal: Number(i.subtotal),
    totalDiscount: Number(i.totalDiscount),
    totalTaxable: Number(i.totalTaxable),
    totalCgst: Number(i.totalCgst),
    totalSgst: Number(i.totalSgst),
    totalIgst: Number(i.totalIgst),
    totalGst: Number(i.totalGst),
    grandTotal: Number(i.grandTotal),
    amountPaid: Number(i.amountPaid),
    balanceDue: Number(i.balanceDue),
  })));
});

router.post("/sale-invoices", authMiddleware, async (req, res) => {
  const data = req.body;

  // Credit limit check — only for credit invoices with a party
  if (data.partyId && Number(data.balanceDue) > 0) {
    const limitError = await checkCreditLimit(Number(data.partyId), Number(data.balanceDue));
    if (limitError) return res.status(400).json({ error: limitError, code: "CREDIT_LIMIT_REACHED" });
  }

  const settings = await db.select().from(companySettingsTable).limit(1);
  const prefix = settings[0]?.invoicePrefix || "INV";
  const invoiceNumber = await makeInvoiceNumber(prefix);

  const [invoice] = await db.insert(saleInvoicesTable).values({
    invoiceNumber,
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    partyGstin: data.partyGstin,
    billingAddress: data.billingAddress,
    isGst: data.isGst ?? true,
    isInterstate: data.isInterstate ?? false,
    subtotal: String(data.subtotal || 0),
    totalDiscount: String(data.totalDiscount || 0),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    totalGst: String(data.totalGst || 0),
    grandTotal: String(data.grandTotal || 0),
    amountPaid: String(data.amountPaid || 0),
    balanceDue: String(data.balanceDue || 0),
    notes: data.notes,
    otherCharges: data.otherCharges || null,
    status: data.amountPaid >= data.grandTotal ? "paid" : (data.amountPaid > 0 ? "partial" : "confirmed"),
  }).returning();

  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(saleInvoiceItemsTable).values({
        invoiceId: invoice.id,
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(item.quantity),
        unit: item.unit,
        rate: String(item.rate),
        discountPct: String(item.discountPct || 0),
        gstPct: String(item.gstPct || 0),
        taxableAmount: String(item.taxableAmount),
        cgst: String(item.cgst || 0),
        sgst: String(item.sgst || 0),
        igst: String(item.igst || 0),
        total: String(item.total),
        batchId: item.batchId || null,
        description: item.description || null,
      });

      if (item.stockItemId) {
        if (data.fromOrderId) {
          await adjustReservedStock(item.batchId || null, -Number(item.quantity));
        }
        const newBalance = await adjustStock(item.stockItemId, item.batchId || null, -Number(item.quantity));
        await db.insert(stockTransactionsTable).values({
          itemId: item.stockItemId,
          batchId: item.batchId || null,
          type: "sale",
          quantity: String(item.quantity),
          balanceAfter: String(newBalance),
          reference: invoiceNumber,
        });
      }
    }
  }

  if (data.payments?.length) {
    for (const payment of data.payments) {
      await db.insert(saleInvoicePaymentsTable).values({
        invoiceId: invoice.id,
        mode: payment.mode,
        amount: String(payment.amount),
        reference: payment.reference || "",
      });
    }
  }

  // If created from an order, mark the order as confirmed and link the invoice
  if (data.fromOrderId) {
    await db.update(ordersTable)
      .set({ status: "confirmed", convertedInvoiceId: invoice.id })
      .where(eq(ordersTable.id, Number(data.fromOrderId)));
  }

  res.status(201).json({ ...invoice, invoiceNumber });
});

router.get("/sale-invoices/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const [invoice] = await db.select().from(saleInvoicesTable)
    .where(eq(saleInvoicesTable.id, Number(id))).limit(1);
  if (!invoice) return res.status(404).json({ error: "Not found" });

  const items = await db.select().from(saleInvoiceItemsTable).where(eq(saleInvoiceItemsTable.invoiceId, Number(id)));
  const payments = await db.select().from(saleInvoicePaymentsTable).where(eq(saleInvoicePaymentsTable.invoiceId, Number(id)));

  res.json({
    ...invoice,
    grandTotal: Number(invoice.grandTotal),
    amountPaid: Number(invoice.amountPaid),
    balanceDue: Number(invoice.balanceDue),
    subtotal: Number(invoice.subtotal),
    totalDiscount: Number(invoice.totalDiscount),
    totalCgst: Number(invoice.totalCgst),
    totalSgst: Number(invoice.totalSgst),
    totalIgst: Number(invoice.totalIgst),
    totalGst: Number(invoice.totalGst),
    items: items.map(i => ({ ...i, quantity: Number(i.quantity), rate: Number(i.rate), total: Number(i.total), cgst: Number(i.cgst), sgst: Number(i.sgst), igst: Number(i.igst) })),
    payments: payments.map(p => ({ ...p, amount: Number(p.amount) })),
  });
});

router.put("/sale-invoices/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  // Credit limit check — exclude this invoice's own existing balance when recalculating
  if (data.partyId && Number(data.balanceDue) > 0) {
    const limitError = await checkCreditLimit(Number(data.partyId), Number(data.balanceDue), Number(id));
    if (limitError) return res.status(400).json({ error: limitError, code: "CREDIT_LIMIT_REACHED" });
  }

  // Update the invoice header
  const [invoice] = await db.update(saleInvoicesTable).set({
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    partyGstin: data.partyGstin,
    billingAddress: data.billingAddress,
    isGst: data.isGst,
    isInterstate: data.isInterstate,
    subtotal: String(data.subtotal || 0),
    totalDiscount: String(data.totalDiscount || 0),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    totalGst: String(data.totalGst || 0),
    grandTotal: String(data.grandTotal || 0),
    amountPaid: String(data.amountPaid || 0),
    balanceDue: String(data.balanceDue || 0),
    notes: data.notes,
    otherCharges: data.otherCharges || null,
    status: data.amountPaid >= data.grandTotal ? "paid" : (data.amountPaid > 0 ? "partial" : "confirmed"),
  }).where(eq(saleInvoicesTable.id, Number(id))).returning();

  if (!invoice) return res.status(404).json({ error: "Not found" });

  // Reverse old stock deductions, then delete old items
  if (data.items?.length) {
    const oldItems = await db.select().from(saleInvoiceItemsTable)
      .where(eq(saleInvoiceItemsTable.invoiceId, Number(id)));

    for (const oldItem of oldItems) {
      if (oldItem.stockItemId) {
        await adjustStock(oldItem.stockItemId, (oldItem as any).batchId || null, Number(oldItem.quantity));
      }
    }

    await db.delete(saleInvoiceItemsTable).where(eq(saleInvoiceItemsTable.invoiceId, Number(id)));

    for (const item of data.items) {
      await db.insert(saleInvoiceItemsTable).values({
        invoiceId: invoice.id,
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(item.quantity),
        unit: item.unit,
        rate: String(item.rate),
        discountPct: String(item.discountPct || 0),
        gstPct: String(item.gstPct || 0),
        taxableAmount: String(item.taxableAmount),
        cgst: String(item.cgst || 0),
        sgst: String(item.sgst || 0),
        igst: String(item.igst || 0),
        total: String(item.total),
        batchId: item.batchId || null,
        description: item.description || null,
      });

      if (item.stockItemId) {
        if (data.fromOrderId) {
          await adjustReservedStock(item.batchId || null, -Number(item.quantity));
        }
        const newBalance = await adjustStock(item.stockItemId, item.batchId || null, -Number(item.quantity));
        await db.insert(stockTransactionsTable).values({
          itemId: item.stockItemId,
          batchId: item.batchId || null,
          type: "sale",
          quantity: String(item.quantity),
          balanceAfter: String(newBalance),
          reference: invoice.invoiceNumber,
        });
      }
    }
  }

  // Replace payments
  await db.delete(saleInvoicePaymentsTable)
    .where(eq(saleInvoicePaymentsTable.invoiceId, Number(id)));

  if (data.payments?.length) {
    for (const payment of data.payments) {
      await db.insert(saleInvoicePaymentsTable).values({
        invoiceId: invoice.id,
        mode: payment.mode,
        amount: String(payment.amount),
        reference: payment.reference || "",
      });
    }
  }

  res.json({ ...invoice, id: invoice.id });
});

// Record an additional payment against an existing invoice
router.post("/sale-invoices/:id/payments", authMiddleware, async (req, res) => {
  const invoiceId = Number(req.params.id);
  const { mode, amount, reference } = req.body;

  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: "Amount must be greater than 0" });
  }

  const [invoice] = await db.select().from(saleInvoicesTable)
    .where(eq(saleInvoicesTable.id, invoiceId)).limit(1);
  if (!invoice) return res.status(404).json({ error: "Not found" });

  const currentPaid = Number(invoice.amountPaid) || 0;
  const grandTotal = Number(invoice.grandTotal) || 0;
  const newPaid = Math.min(currentPaid + Number(amount), grandTotal);
  const newBalance = grandTotal - newPaid;
  const newStatus = newPaid >= grandTotal ? "paid" : newPaid > 0 ? "partial" : "confirmed";

  await db.insert(saleInvoicePaymentsTable).values({
    invoiceId,
    mode: mode || "cash",
    amount: String(Number(amount)),
    reference: reference || "",
  });

  await db.update(saleInvoicesTable).set({
    amountPaid: String(newPaid),
    balanceDue: String(newBalance),
    status: newStatus,
  }).where(eq(saleInvoicesTable.id, invoiceId));

  res.json({ ok: true, amountPaid: newPaid, balanceDue: newBalance, status: newStatus });
});

router.delete("/sale-invoices/:id", authMiddleware, async (req, res) => {
  await db.update(saleInvoicesTable).set({ isDeleted: "true" }).where(eq(saleInvoicesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
