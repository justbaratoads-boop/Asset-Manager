import { Router } from "express";
import { db } from "@workspace/db";
import {
  saleInvoicesTable, saleInvoiceItemsTable, saleInvoicePaymentsTable, stockTransactionsTable,
  ordersTable,
  stockItemsTable } from "@workspace/db/schema";
import { adjustStock, adjustReservedStock } from "../lib/batch-stock";
import { partiesTable } from "@workspace/db/schema";
import { eq, and, ilike, gte, lte, sql, ne, inArray } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeInvoiceNumber, makeKacchaInvoiceNumber } from "../lib/counter";
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

  const settings = await db.select().from(companySettingsTable).limit(1);
  const enableDualLedger = settings[0]?.enableDualLedger === "true" || settings[0]?.enableDualLedger === true;
  const prefix = settings[0]?.invoicePrefix || "INV";
  const kacchaPrefix = settings[0]?.kacchaInvoicePrefix || "KCH";
  const reqDate = new Date(data.date || Date.now());
  const finStartMonth = settings[0]?.financialYearStart || 4;
  const finYearNum = (reqDate.getMonth() + 1) >= finStartMonth ? reqDate.getFullYear() : reqDate.getFullYear() - 1;
  const finYear = String(finYearNum);

  let kacchaItems = [];
  let pakkaItems = [];

  if (enableDualLedger && data.items?.length) {
    kacchaItems = data.items.filter((i: any) => i.isTaxLiability === false);
    pakkaItems = data.items.filter((i: any) => i.isTaxLiability !== false);
  } else {
    pakkaItems = data.items || [];
  }

  // Credit limit check
  const totalBalanceDue = Number(data.balanceDue || 0) + Number(data.kacchaBalanceDue || 0);
  if (data.partyId && totalBalanceDue > 0) {
    const limitError = await checkCreditLimit(Number(data.partyId), totalBalanceDue);
    if (limitError) return res.status(400).json({ error: limitError, code: "CREDIT_LIMIT_REACHED" });
  }

  async function createInvoicePart(itemsToSave: any[], isKaccha: boolean, paymentsToSave: any[], partAmountPaid: number, partBalanceDue: number, partGrandTotal: number) {
    const invNum = isKaccha ? await makeKacchaInvoiceNumber(kacchaPrefix, finYear) : await makeInvoiceNumber(prefix);
    const sub = itemsToSave.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const disc = itemsToSave.reduce((s, i) => s + (Number(i.discountPct || 0) / 100) * Number(i.quantity) * Number(i.rate), 0);
    const base = itemsToSave.reduce((s, i) => s + Number(i.taxableAmount), 0);
    const cgst = itemsToSave.reduce((s, i) => s + Number(i.cgst || 0), 0);
    const sgst = itemsToSave.reduce((s, i) => s + Number(i.sgst || 0), 0);
    const igst = itemsToSave.reduce((s, i) => s + Number(i.igst || 0), 0);
    const totGst = cgst + sgst + igst;
    
    let otherChargesParsed = 0;
    const targetCharges = isKaccha ? data.kacchaCharges : data.otherCharges;
    if (targetCharges) {
      try {
        const charges = JSON.parse(targetCharges);
        otherChargesParsed = charges.reduce((s: number, c: any) => s + ((c.type ?? "add") === "deduct" ? -Number(c.amount) : Number(c.amount)), 0);
      } catch (e) {}
    }
    const gTotal = partGrandTotal ?? (base + totGst + otherChargesParsed);

    const [inv] = await db.insert(saleInvoicesTable).values({
      invoiceNumber: invNum,
      date: data.date,
      partyId: data.partyId,
      partyName: data.partyName,
      partyGstin: data.partyGstin,
      billingAddress: data.billingAddress,
      isGst: isKaccha ? false : (data.isGst ?? true),
      isInterstate: data.isInterstate ?? false,
      isKaccha: isKaccha,
      subtotal: String(sub),
      totalDiscount: String(disc),
      totalTaxable: String(base),
      totalCgst: String(cgst),
      totalSgst: String(sgst),
      totalIgst: String(igst),
      totalGst: String(totGst),
      grandTotal: String(gTotal),
      amountPaid: String(partAmountPaid || 0),
      balanceDue: String(partBalanceDue || 0),
      notes: data.notes,
      otherCharges: targetCharges || null,
      status: partAmountPaid >= gTotal ? "paid" : (partAmountPaid > 0 ? "partial" : "confirmed"),
    }).returning();

    for (const item of itemsToSave) {
      await db.insert(saleInvoiceItemsTable).values({
        invoiceId: inv.id,
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(Number(item.quantity) || 0),
        unit: item.unit,
        rate: String(Number(item.rate) || 0),
        discountPct: String(Number(item.discountPct) || 0),
        gstPct: String(isKaccha ? 0 : (Number(item.gstPct) || 0)),
        gstInclusive: isKaccha ? false : (item.gstInclusive === true || item.gstInclusive === "true"),
        taxableAmount: String(Number(item.taxableAmount) || 0),
        cgst: String(isKaccha ? 0 : (Number(item.cgst) || 0)),
        sgst: String(isKaccha ? 0 : (Number(item.sgst) || 0)),
        igst: String(isKaccha ? 0 : (Number(item.igst) || 0)),
        total: String(Number(item.total) || 0),
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
          quantity: String(Number(item.quantity) || 0),
          balanceAfter: String(newBalance),
          reference: invNum,
          isKaccha: isKaccha,
        } as any);
      }
    }

    if (paymentsToSave?.length) {
      for (const payment of paymentsToSave) {
        await db.insert(saleInvoicePaymentsTable).values({
          invoiceId: inv.id,
          mode: payment.mode,
          amount: String(Number(payment.amount) || 0),
          reference: payment.reference || "",
        });
      }
    }

    return { ...inv, invoiceNumber: invNum };
  }

  let finalInvoice = null;

  if (kacchaItems.length > 0) {
    const kacchaGrandTotalCalc = data.kacchaGrandTotal ?? kacchaItems.reduce((s: number, i: any) => s + Number(i.total), 0);
    const kInv = await createInvoicePart(kacchaItems, true, data.kacchaPayments || [], data.kacchaAmountPaid, data.kacchaBalanceDue, kacchaGrandTotalCalc);
    if (!finalInvoice) finalInvoice = kInv;
  }
  
  if (pakkaItems.length > 0) {
    const pInv = await createInvoicePart(pakkaItems, false, data.payments || [], data.amountPaid, data.balanceDue, data.pakkaGrandTotal ?? data.grandTotal);
    finalInvoice = pInv;
  }

  if (data.fromOrderId && finalInvoice) {
    await db.update(ordersTable)
      .set({ status: "confirmed", convertedInvoiceId: finalInvoice.id })
      .where(eq(ordersTable.id, Number(data.fromOrderId)));
  }

  res.status(201).json(finalInvoice || {});
});

router.get("/sale-invoices/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const [invoice] = await db.select().from(saleInvoicesTable)
    .where(eq(saleInvoicesTable.id, Number(id))).limit(1);
  if (!invoice) return res.status(404).json({ error: "Not found" });

  const items = await db.select({
    id: saleInvoiceItemsTable.id,
    invoiceId: saleInvoiceItemsTable.invoiceId,
    stockItemId: saleInvoiceItemsTable.stockItemId,
    itemName: saleInvoiceItemsTable.itemName,
    hsnCode: saleInvoiceItemsTable.hsnCode,
    quantity: saleInvoiceItemsTable.quantity,
    unit: saleInvoiceItemsTable.unit,
    rate: saleInvoiceItemsTable.rate,
    discountPct: saleInvoiceItemsTable.discountPct,
    gstPct: saleInvoiceItemsTable.gstPct,
    gstInclusive: saleInvoiceItemsTable.gstInclusive,
    taxableAmount: saleInvoiceItemsTable.taxableAmount,
    cgst: saleInvoiceItemsTable.cgst,
    sgst: saleInvoiceItemsTable.sgst,
    igst: saleInvoiceItemsTable.igst,
    total: saleInvoiceItemsTable.total,
    batchId: saleInvoiceItemsTable.batchId,
    description: saleInvoiceItemsTable.description,
    isTaxLiability: stockItemsTable.isTaxLiability,
  }).from(saleInvoiceItemsTable).leftJoin(stockItemsTable, eq(saleInvoiceItemsTable.stockItemId, stockItemsTable.id)).where(eq(saleInvoiceItemsTable.invoiceId, Number(id)));
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
    items: items.map(i => ({ ...i, quantity: (isNaN(Number(i.quantity)) ? 0 : Number(i.quantity)), rate: (isNaN(Number(i.rate)) ? 0 : Number(i.rate)), discountPct: (isNaN(Number(i.discountPct)) ? 0 : Number(i.discountPct)), gstPct: (isNaN(Number(i.gstPct)) ? 0 : Number(i.gstPct)), gstInclusive: i.gstInclusive === true, taxableAmount: (isNaN(Number(i.taxableAmount)) ? 0 : Number(i.taxableAmount)), total: (isNaN(Number(i.total)) ? 0 : Number(i.total)), cgst: (isNaN(Number(i.cgst)) ? 0 : Number(i.cgst)), sgst: (isNaN(Number(i.sgst)) ? 0 : Number(i.sgst)), igst: (isNaN(Number(i.igst)) ? 0 : Number(i.igst)), isTaxLiability: i.isTaxLiability ?? true })),
    payments: payments.map(p => ({ ...p, amount: Number(p.amount) })),
  });
});

router.put("/sale-invoices/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  
  const data = req.body;
  
  const [existingInvoice] = await db.select().from(saleInvoicesTable).where(eq(saleInvoicesTable.id, Number(req.params.id))).limit(1);
  if (!existingInvoice) return res.status(404).json({ error: "Not found" });

  const settings = await db.select().from(companySettingsTable).limit(1);
  const enableDualLedger = settings[0]?.enableDualLedger === "true" || settings[0]?.enableDualLedger === true;

  if (enableDualLedger && data.items?.length) {
    const isKacchaInvoice = existingInvoice.isKaccha;
    
    const stockItemIds = data.items.map((i: any) => i.stockItemId).filter(Boolean);
    const stockItems = stockItemIds.length ? await db.select().from(stockItemsTable).where(inArray(stockItemsTable.id, stockItemIds)) : [];
    const stockMap = Object.fromEntries(stockItems.map((s: any) => [s.id, s.isTaxLiability]));

    const hasInvalidItems = data.items.some((i: any) => {
       const isTax = i.isTaxLiability !== undefined ? i.isTaxLiability : stockMap[i.stockItemId] ?? true;
       return isKacchaInvoice ? isTax !== false : isTax === false;
    });

    
    if (hasInvalidItems) {
      return res.status(400).json({ error: isKacchaInvoice ? "Cannot add Pakka (taxable) items to a Kaccha bill." : "Cannot add Kaccha (non-taxable) items to a Pakka bill." });
    }
  }


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
    subtotal: String(existingInvoice.isKaccha ? ((data.kacchaSubtotal ?? data.subtotal) || 0) : (data.subtotal || 0)),
    totalDiscount: String(data.totalDiscount || 0),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    totalGst: String(data.totalGst || 0),
    grandTotal: String(existingInvoice.isKaccha ? ((data.kacchaGrandTotal ?? data.grandTotal) || 0) : (data.grandTotal || 0)),
    amountPaid: String(existingInvoice.isKaccha ? ((data.kacchaAmountPaid ?? data.amountPaid) || 0) : (data.amountPaid || 0)),
    balanceDue: String(existingInvoice.isKaccha ? ((data.kacchaBalanceDue ?? data.balanceDue) || 0) : (data.balanceDue || 0)),
    notes: data.notes,
    otherCharges: existingInvoice.isKaccha ? (data.kacchaCharges || null) : (data.otherCharges || null),
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
        quantity: String(Number(item.quantity) || 0),
        unit: item.unit,
        rate: String(Number(item.rate) || 0),
        discountPct: String(Number(item.discountPct) || 0),
        gstPct: String(Number(item.gstPct) || 0),
        gstInclusive: item.gstInclusive === true || item.gstInclusive === "true",
        taxableAmount: String(Number(item.taxableAmount) || 0),
        cgst: String(Number(item.cgst) || 0),
        sgst: String(Number(item.sgst) || 0),
        igst: String(Number(item.igst) || 0),
        total: String(Number(item.total) || 0),
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
          quantity: String(Number(item.quantity) || 0),
          balanceAfter: String(newBalance),
          reference: invoice.invoiceNumber,
          isKaccha: invoice.isKaccha,
        } as any);
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
        amount: String(Number(payment.amount) || 0),
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
