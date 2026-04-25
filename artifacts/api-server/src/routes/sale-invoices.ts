import { Router } from "express";
import { db } from "@workspace/db";
import {
  saleInvoicesTable, saleInvoiceItemsTable, saleInvoicePaymentsTable, stockItemsTable, stockTransactionsTable
} from "@workspace/db/schema";
import { eq, and, like, gte, lte, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeInvoiceNumber } from "../lib/counter";
import { companySettingsTable } from "@workspace/db/schema";

const router = Router();

router.get("/sale-invoices", authMiddleware, async (req, res) => {
  const { search, from, to, status } = req.query;
  const conditions: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
  if (search) conditions.push(like(saleInvoicesTable.partyName, `%${search}%`));
  if (from) conditions.push(gte(saleInvoicesTable.date, from as string));
  if (to) conditions.push(lte(saleInvoicesTable.date, to as string));
  if (status) conditions.push(eq(saleInvoicesTable.status, status as string));

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
      });

      if (item.stockItemId) {
        const [si] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, item.stockItemId)).limit(1);
        if (si) {
          const newStock = Number(si.physicalStock) - Number(item.quantity);
          await db.update(stockItemsTable).set({ physicalStock: String(newStock) }).where(eq(stockItemsTable.id, item.stockItemId));
          await db.insert(stockTransactionsTable).values({
            itemId: item.stockItemId,
            type: "sale",
            quantity: String(item.quantity),
            balanceAfter: String(newStock),
            reference: invoiceNumber,
          });
        }
      }
    }
  }

  if (data.payments?.length) {
    for (const payment of data.payments) {
      await db.insert(saleInvoicePaymentsTable).values({
        invoiceId: invoice.id,
        mode: payment.mode,
        amount: String(payment.amount),
        reference: payment.reference,
      });
    }
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
  const [invoice] = await db.update(saleInvoicesTable).set({
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    notes: data.notes,
    status: data.status,
  }).where(eq(saleInvoicesTable.id, Number(id))).returning();
  if (!invoice) return res.status(404).json({ error: "Not found" });
  res.json(invoice);
});

router.delete("/sale-invoices/:id", authMiddleware, async (req, res) => {
  await db.update(saleInvoicesTable).set({ isDeleted: "true" }).where(eq(saleInvoicesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

export default router;
