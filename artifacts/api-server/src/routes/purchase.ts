import { Router } from "express";
import { db } from "@workspace/db";
import {
  purchaseInvoicesTable, purchaseInvoiceItemsTable, purchaseInvoicePaymentsTable,
  purchaseOrdersTable, purchaseOrderItemsTable, stockTransactionsTable, companySettingsTable,
  stockItemsTable } from "@workspace/db/schema";
import { eq, and, ilike, sql, inArray } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeInvoiceNumber, makeKacchaInvoiceNumber, makeVoucherNumber } from "../lib/counter";
import { adjustStock } from "../lib/batch-stock";

const router = Router();

// Purchase invoices
router.get("/purchase-invoices", authMiddleware, async (req, res) => {
  const { search, partyId, status } = req.query;
  const conditions: any[] = [eq(purchaseInvoicesTable.isDeleted, "false")];
  if (search) conditions.push(ilike(purchaseInvoicesTable.partyName, `%${search}%`));
  if (partyId) conditions.push(eq(purchaseInvoicesTable.partyId, Number(partyId)));
  if (status) conditions.push(eq(purchaseInvoicesTable.status, status as string));

  const invoices = await db.select().from(purchaseInvoicesTable)
    .where(and(...conditions))
    .orderBy(sql`created_at DESC`);

  res.json(invoices.map(i => ({
    ...i,
    grandTotal: Number(i.grandTotal),
    amountPaid: Number(i.amountPaid),
    balanceDue: Number(i.balanceDue),
  })));
});

router.post("/purchase-invoices", authMiddleware, async (req, res) => {
  const data = req.body;

  const settings = await db.select().from(companySettingsTable).limit(1);
  const enableDualLedger = settings[0]?.enableDualLedger === "true" || settings[0]?.enableDualLedger === true;
  const prefix = settings[0]?.purchasePrefix || "PUR";
  const kacchaPrefix = settings[0]?.kacchaPurchasePrefix || "KPUR";
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

  async function createInvoicePart(itemsToSave: any[], isKaccha: boolean, paymentsToSave: any[], partAmountPaid: number, partBalanceDue: number, partGrandTotal: number) {
    const invNum = isKaccha ? await makeKacchaInvoiceNumber(kacchaPrefix, finYear) : await makeInvoiceNumber(prefix);
    const sub = itemsToSave.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const base = itemsToSave.reduce((s, i) => s + Number(i.taxableAmount || 0), 0);
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

    const [inv] = await db.insert(purchaseInvoicesTable).values({
      invoiceNumber: invNum,
      supplierInvoiceNumber: data.supplierInvoiceNumber,
      date: data.date,
      partyId: data.partyId,
      partyName: data.partyName,
      isGst: isKaccha ? false : (data.isGst ?? true),
      isInterstate: data.isInterstate ?? false,
      isReverseCharge: isKaccha ? false : (data.isReverseCharge ?? false),
      isKaccha: isKaccha,
      subtotal: String(sub),
      totalTaxable: String(base),
      totalCgst: String(cgst),
      totalSgst: String(sgst),
      totalIgst: String(igst),
      grandTotal: String(gTotal),
      amountPaid: String(partAmountPaid || 0),
      balanceDue: String(partBalanceDue || 0),
      notes: data.notes,
      otherCharges: targetCharges || null,
    }).returning();

    for (const item of itemsToSave) {
      await db.insert(purchaseInvoiceItemsTable).values({
        invoiceId: inv.id,
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(Number(item.quantity) || 0),
        unit: item.unit,
        rate: String(Number(item.rate) || 0),
        discountPct: String(Number(item.discountPct) || 0),
        gstPct: String(isKaccha ? 0 : (Number(item.gstPct) || 0)),
        taxableAmount: String(Number(item.taxableAmount) || 0),
        cgst: String(isKaccha ? 0 : (Number(item.cgst) || 0)),
        sgst: String(isKaccha ? 0 : (Number(item.sgst) || 0)),
        igst: String(isKaccha ? 0 : (Number(item.igst) || 0)),
        batchId: item.batchId || null,
        total: String(Number(item.total) || 0),
      });

      if (item.stockItemId) {
        const newBalance = await adjustStock(item.stockItemId, item.batchId || null, Number(item.quantity));
        await db.insert(stockTransactionsTable).values({
          itemId: item.stockItemId,
          batchId: item.batchId || null,
          type: "purchase",
          quantity: String(Number(item.quantity) || 0),
          balanceAfter: String(newBalance),
          reference: invNum,
          isKaccha: isKaccha,
        } as any);
      }
    }

    if (paymentsToSave?.length) {
      for (const payment of paymentsToSave) {
        await db.insert(purchaseInvoicePaymentsTable).values({
          invoiceId: inv.id,
          mode: payment.mode,
          amount: String(Number(payment.amount) || 0),
          reference: payment.reference,
        });
      }
    }

    return inv;
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

  res.status(201).json(finalInvoice || {});
});
router.get("/purchase-invoices/:id", authMiddleware, async (req, res) => {
  const [invoice] = await db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.id, Number(req.params.id))).limit(1);
  if (!invoice) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(purchaseInvoiceItemsTable).where(eq(purchaseInvoiceItemsTable.invoiceId, Number(req.params.id)));
  const payments = await db.select().from(purchaseInvoicePaymentsTable).where(eq(purchaseInvoicePaymentsTable.invoiceId, Number(req.params.id)));
  res.json({ ...invoice, grandTotal: Number(invoice.grandTotal), items: items.map(i => ({ ...i, quantity: (isNaN(Number(i.quantity)) ? 0 : Number(i.quantity)), rate: (isNaN(Number(i.rate)) ? 0 : Number(i.rate)), discountPct: (isNaN(Number(i.discountPct)) ? 0 : Number(i.discountPct)), gstPct: (isNaN(Number(i.gstPct)) ? 0 : Number(i.gstPct)), taxableAmount: (isNaN(Number(i.taxableAmount)) ? 0 : Number(i.taxableAmount)), total: (isNaN(Number(i.total)) ? 0 : Number(i.total)), cgst: (isNaN(Number(i.cgst)) ? 0 : Number(i.cgst)), sgst: (isNaN(Number(i.sgst)) ? 0 : Number(i.sgst)), igst: (isNaN(Number(i.igst)) ? 0 : Number(i.igst)) })), payments });
});

router.put("/purchase-invoices/:id", authMiddleware, async (req, res) => {
  
  const data = req.body;
  
  const [existingInvoice] = await db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.id, Number(req.params.id))).limit(1);
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

  const grandTotal = Number(data.grandTotal || 0);
  const amountPaid = Number(data.amountPaid || 0);
  const balanceDue = grandTotal - amountPaid;
  const status = balanceDue <= 0 ? "paid" : amountPaid > 0 ? "partial" : "confirmed";

  const [invoice] = await db.update(purchaseInvoicesTable).set({
    supplierInvoiceNumber: data.supplierInvoiceNumber,
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    isGst: data.isGst ?? true,
    isInterstate: data.isInterstate ?? false,
    subtotal: String(data.subtotal || 0),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    grandTotal: String(grandTotal),
    amountPaid: String(amountPaid),
    balanceDue: String(balanceDue),
    status,
    notes: data.notes,
    otherCharges: data.otherCharges || null,
  }).where(eq(purchaseInvoicesTable.id, Number(req.params.id))).returning();
  if (!invoice) return res.status(404).json({ error: "Not found" });

  // Reverse old items' physical + batch stock before replacing
  const oldItems = await db.select().from(purchaseInvoiceItemsTable).where(eq(purchaseInvoiceItemsTable.invoiceId, Number(req.params.id)));
  for (const oldItem of oldItems) {
    if (oldItem.stockItemId) {
      await adjustStock(oldItem.stockItemId, (oldItem as any).batchId || null, -Number(oldItem.quantity));
    }
  }

  // Replace items
  await db.delete(purchaseInvoiceItemsTable).where(eq(purchaseInvoiceItemsTable.invoiceId, Number(req.params.id)));
  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(purchaseInvoiceItemsTable).values({
        invoiceId: Number(req.params.id),
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(Number(item.quantity) || 0),
        unit: item.unit,
        rate: String(Number(item.rate) || 0),
        discountPct: String(Number(item.discountPct) || 0),
        gstPct: String(Number(item.gstPct) || 0),
        taxableAmount: String(Number(item.taxableAmount) || 0),
        cgst: String(Number(item.cgst) || 0),
        sgst: String(Number(item.sgst) || 0),
        igst: String(Number(item.igst) || 0),
        batchId: item.batchId || null,
        total: String(Number(item.total) || 0),
      });
      if (item.stockItemId) {
        await adjustStock(item.stockItemId, item.batchId || null, Number(item.quantity));
      }
    }
  }

  // Append new payments
  if (data.payments?.length) {
    for (const payment of data.payments) {
      await db.insert(purchaseInvoicePaymentsTable).values({
        invoiceId: Number(req.params.id),
        mode: payment.mode,
        amount: String(Number(payment.amount) || 0),
        reference: payment.reference,
      });
    }
  }

  res.json({ ...invoice, grandTotal, amountPaid, balanceDue, status });
});

// Record a payment against an existing purchase invoice
router.post("/purchase-invoices/:id/payment", authMiddleware, async (req, res) => {
  const { amount, mode, reference } = req.body;
  const payAmount = Number(amount);
  if (!payAmount || payAmount <= 0) return res.status(400).json({ error: "Invalid payment amount" });

  const [inv] = await db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.id, Number(req.params.id))).limit(1);
  if (!inv) return res.status(404).json({ error: "Not found" });

  const currentPaid = Number(inv.amountPaid);
  const grandTotal = Number(inv.grandTotal);
  const newPaid = Math.min(currentPaid + payAmount, grandTotal);
  const newBalance = grandTotal - newPaid;
  const status = newBalance <= 0 ? "paid" : "partial";

  await db.update(purchaseInvoicesTable).set({
    amountPaid: String(newPaid),
    balanceDue: String(newBalance),
    status,
  }).where(eq(purchaseInvoicesTable.id, Number(req.params.id)));

  await db.insert(purchaseInvoicePaymentsTable).values({
    invoiceId: Number(req.params.id),
    mode: mode || "cash",
    amount: String(payAmount),
    reference,
  });

  res.json({ ok: true, amountPaid: newPaid, balanceDue: newBalance, status });
});

router.delete("/purchase-invoices/:id", authMiddleware, async (req, res) => {
  await db.update(purchaseInvoicesTable).set({ isDeleted: "true" }).where(eq(purchaseInvoicesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.post("/purchase-invoices/:id/cancel", authMiddleware, async (req, res) => {
  const [inv] = await db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.id, Number(req.params.id))).limit(1);
  if (!inv) return res.status(404).json({ error: "Not found" });
  if (inv.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });
  await db.update(purchaseInvoicesTable).set({ status: "cancelled" }).where(eq(purchaseInvoicesTable.id, Number(req.params.id)));
  res.json({ ok: true, status: "cancelled" });
});

router.post("/purchase-invoices/:id/uncancel", authMiddleware, async (req, res) => {
  const [inv] = await db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.id, Number(req.params.id))).limit(1);
  if (!inv) return res.status(404).json({ error: "Not found" });
  if (inv.status !== "cancelled") return res.status(400).json({ error: "Invoice is not cancelled" });
  const paid = Number(inv.amountPaid);
  const total = Number(inv.grandTotal);
  const balance = Number(inv.balanceDue);
  const restored = balance <= 0 ? "paid" : paid > 0 ? "partial" : "confirmed";
  await db.update(purchaseInvoicesTable).set({ status: restored }).where(eq(purchaseInvoicesTable.id, Number(req.params.id)));
  res.json({ ok: true, status: restored });
});

// Purchase orders
router.get("/purchase-orders", authMiddleware, async (req, res) => {
  const conditions: any[] = [eq(purchaseOrdersTable.isDeleted, "false")];
  const orders = await db.select().from(purchaseOrdersTable).where(and(...conditions)).orderBy(sql`created_at DESC`);
  res.json(orders.map(o => ({ ...o, grandTotal: Number(o.grandTotal) })));
});

router.post("/purchase-orders", authMiddleware, async (req, res) => {
  const data = req.body;
  if (!data.partyName) return res.status(400).json({ error: "Party name is required" });
  if (!data.date) return res.status(400).json({ error: "Date is required" });
  if (!data.items || data.items.length === 0) return res.status(400).json({ error: "At least one item is required" });

  const poNumber = await makeVoucherNumber("PO");
  const [order] = await db.insert(purchaseOrdersTable).values({
    poNumber,
    date: data.date,
    partyId: data.partyId || null,
    partyName: data.partyName,
    status: "open",
    grandTotal: String(data.grandTotal || 0),
    notes: data.notes || null,
    deliveryDate: data.deliveryDate || null,
  }).returning();

  for (const item of data.items) {
    if (!item.itemName) continue;
    await db.insert(purchaseOrderItemsTable).values({
      orderId: order.id,
      stockItemId: item.stockItemId || null,
      itemName: item.itemName,
      hsnCode: item.hsnCode || null,
      quantity: String(Number(item.quantity) || 0),
      unit: item.unit || "pcs",
      rate: String(Number(item.rate) || 0),
      discountPct: String(Number(item.discountPct) || 0),
      gstPct: String(Number(item.gstPct) || 0),
      taxableAmount: String(Number(item.taxableAmount) || 0),
      cgst: String(Number(item.cgst) || 0),
      sgst: String(Number(item.sgst) || 0),
      igst: String(Number(item.igst) || 0),
      batchId: item.batchId || null,
      total: String(Number(item.total) || 0),
    });
    if (item.stockItemId) {
      const newBalance = await adjustStock(item.stockItemId, item.batchId || null, Number(item.quantity));
      await db.insert(stockTransactionsTable).values({
        itemId: item.stockItemId,
        batchId: item.batchId || null,
        type: "purchase-order",
        quantity: String(Number(item.quantity) || 0),
        balanceAfter: String(newBalance),
        reference: poNumber,
      });
    }
  }
  res.status(201).json({ ...order, deliveryDate: order.deliveryDate });
});

router.get("/purchase-orders/:id", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.orderId, Number(req.params.id)));
  res.json({ ...order, grandTotal: Number(order.grandTotal), items });
});

router.put("/purchase-orders/:id", authMiddleware, async (req, res) => {
  const data = req.body;
  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.partyId !== undefined) updateData.partyId = data.partyId || null;
  if (data.partyName !== undefined) updateData.partyName = data.partyName;
  if (data.notes !== undefined) updateData.notes = data.notes || null;
  if (data.deliveryDate !== undefined) updateData.deliveryDate = data.deliveryDate || null;
  if (data.grandTotal !== undefined) updateData.grandTotal = String(data.grandTotal || 0);

  const [order] = await db.update(purchaseOrdersTable).set(updateData).where(eq(purchaseOrdersTable.id, Number(req.params.id))).returning();
  if (!order) return res.status(404).json({ error: "Not found" });

  if (data.items?.length) {
    // Reverse stock for old items before replacing
    const oldItems = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.orderId, Number(req.params.id)));
    for (const oldItem of oldItems) {
      if (oldItem.stockItemId) {
        await adjustStock(oldItem.stockItemId, (oldItem as any).batchId || null, -Number(oldItem.quantity));
      }
    }
    await db.delete(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.orderId, Number(req.params.id)));
    for (const item of data.items) {
      if (!item.itemName) continue;
      await db.insert(purchaseOrderItemsTable).values({
        orderId: order.id,
        stockItemId: item.stockItemId || null,
        itemName: item.itemName,
        hsnCode: item.hsnCode || null,
        quantity: String(Number(item.quantity) || 0),
        unit: item.unit || "pcs",
        rate: String(Number(item.rate) || 0),
        discountPct: String(Number(item.discountPct) || 0),
        gstPct: String(Number(item.gstPct) || 0),
        taxableAmount: String(Number(item.taxableAmount) || 0),
        cgst: String(Number(item.cgst) || 0),
        sgst: String(Number(item.sgst) || 0),
        igst: String(Number(item.igst) || 0),
        batchId: item.batchId || null,
        total: String(Number(item.total) || 0),
      });
      if (item.stockItemId) {
        await adjustStock(item.stockItemId, item.batchId || null, Number(item.quantity));
      }
    }
  }

  res.json(order);
});

router.delete("/purchase-orders/:id", authMiddleware, async (req, res) => {
  const orderId = Number(req.params.id);
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, orderId)).limit(1);
  if (order && order.status !== "cancelled") {
    const items = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.orderId, orderId));
    for (const item of items) {
      if (item.stockItemId) {
        await adjustStock(item.stockItemId, (item as any).batchId || null, -Number(item.quantity));
      }
    }
  }
  await db.update(purchaseOrdersTable).set({ isDeleted: "true" }).where(eq(purchaseOrdersTable.id, orderId));
  res.json({ ok: true });
});

router.post("/purchase-orders/:id/cancel", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });
  const items = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.orderId, order.id));
  for (const item of items) {
    if (item.stockItemId) {
      await adjustStock(item.stockItemId, (item as any).batchId || null, -Number(item.quantity));
    }
  }
  await db.update(purchaseOrdersTable).set({ status: "cancelled" }).where(eq(purchaseOrdersTable.id, Number(req.params.id)));
  res.json({ ok: true, status: "cancelled" });
});

router.post("/purchase-orders/:id/uncancel", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status !== "cancelled") return res.status(400).json({ error: "Order is not cancelled" });
  const items = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.orderId, order.id));
  for (const item of items) {
    if (item.stockItemId) {
      await adjustStock(item.stockItemId, (item as any).batchId || null, Number(item.quantity));
    }
  }
  await db.update(purchaseOrdersTable).set({ status: "open" }).where(eq(purchaseOrdersTable.id, Number(req.params.id)));
  res.json({ ok: true, status: "open" });
});

router.post("/purchase-orders/:id/receive", authMiddleware, async (req, res) => {
  const { items: receivedItems } = req.body;
  // receivedItems: Array<{ itemId: number; receivedQty: number }>

  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });

  const orderItems = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.orderId, order.id));

  const receivedMap = new Map((receivedItems || []).map((r: any) => [Number(r.itemId), Number(r.receivedQty) || 0]));

  // Validate: new receipt qty must not exceed remaining qty (ordered - already received)
  for (const item of orderItems) {
    const alreadyReceived = Number(item.receivedQty) || 0;
    const remaining = Number(item.quantity) - alreadyReceived;
    const nowReceiving = receivedMap.get(item.id) || 0;
    if (nowReceiving > remaining) {
      return res.status(400).json({ error: `"${item.itemName}": cannot receive ${nowReceiving} — only ${remaining} remaining` });
    }
  }

  let anyReceived = false;
  let allFullyReceived = true;
  const updatedReceivedQtys: Map<number, number> = new Map();

  for (const item of orderItems) {
    const alreadyReceived = Number(item.receivedQty) || 0;
    const nowReceiving = receivedMap.get(item.id) || 0;
    const newTotal = alreadyReceived + nowReceiving;
    if (nowReceiving > 0) anyReceived = true;
    if (newTotal < Number(item.quantity)) allFullyReceived = false;
    updatedReceivedQtys.set(item.id, newTotal);
  }

  if (!anyReceived) return res.status(400).json({ error: "At least one item must have a received quantity > 0" });

  const newStatus = allFullyReceived ? "received" : "partially_received";

  // Update order status and each item's cumulative receivedQty
  await db.update(purchaseOrdersTable).set({ status: newStatus }).where(eq(purchaseOrdersTable.id, order.id));
  for (const item of orderItems) {
    const newTotal = updatedReceivedQtys.get(item.id) ?? Number(item.receivedQty);
    await db.update(purchaseOrderItemsTable)
      .set({ receivedQty: String(newTotal) })
      .where(eq(purchaseOrderItemsTable.id, item.id));
  }

  // Auto-create purchase invoice for this batch of received items only
  const invoiceNumber = await makeInvoiceNumber("PUR");
  let grandTotal = 0, totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

  const invoiceItemsToInsert = [];
  for (const item of orderItems) {
    const rqty = receivedMap.get(item.id) || 0;
    if (rqty <= 0) continue;

    const orderedQty = Number(item.quantity);
    const ratio = orderedQty > 0 ? rqty / orderedQty : 1;
    const rate = Number(item.rate);
    const discPct = Number(item.discountPct) || 0;
    const gstPct = Number(item.gstPct) || 0;
    const taxable = Number(item.taxableAmount) * ratio;
    const cgst = Number(item.cgst) * ratio;
    const sgst = Number(item.sgst) * ratio;
    const igst = Number(item.igst) * ratio;
    const total = Number(item.total) * ratio;

    totalTaxable += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    grandTotal += total;

    invoiceItemsToInsert.push({
      stockItemId: item.stockItemId,
      itemName: item.itemName,
      hsnCode: item.hsnCode,
      quantity: rqty,
      unit: item.unit,
      rate: String(rate),
      discountPct: String(discPct),
      gstPct: String(gstPct),
      taxableAmount: String(taxable.toFixed(2)),
      cgst: String(cgst.toFixed(2)),
      sgst: String(sgst.toFixed(2)),
      igst: String(igst.toFixed(2)),
      total: String(total.toFixed(2)),
      batchId: (item as any).batchId || null,
    });
  }

  const [invoice] = await db.insert(purchaseInvoicesTable).values({
    invoiceNumber,
    date: new Date().toISOString().slice(0, 10),
    partyId: order.partyId,
    partyName: order.partyName,
    isGst: true,
    isInterstate: false,
    isReverseCharge: false,
    subtotal: String(totalTaxable.toFixed(2)),
    totalTaxable: String(totalTaxable.toFixed(2)),
    totalCgst: String(totalCgst.toFixed(2)),
    totalSgst: String(totalSgst.toFixed(2)),
    totalIgst: String(totalIgst.toFixed(2)),
    grandTotal: String(grandTotal.toFixed(2)),
    amountPaid: "0",
    balanceDue: String(grandTotal.toFixed(2)),
    notes: `Auto-generated from PO ${order.poNumber}`,
  }).returning();

  for (const item of invoiceItemsToInsert) {
    await db.insert(purchaseInvoiceItemsTable).values({ invoiceId: invoice.id, ...item });
  }

  res.json({ ok: true, status: newStatus, invoiceId: invoice.id, invoiceNumber });
});

export default router;
