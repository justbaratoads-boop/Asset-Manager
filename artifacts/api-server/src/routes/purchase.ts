import { Router } from "express";
import { db } from "@workspace/db";
import {
  purchaseInvoicesTable, purchaseInvoiceItemsTable, purchaseInvoicePaymentsTable,
  purchaseOrdersTable, purchaseOrderItemsTable, stockItemsTable, stockTransactionsTable
} from "@workspace/db/schema";
import { eq, and, like, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeInvoiceNumber, makeVoucherNumber } from "../lib/counter";

const router = Router();

// Purchase invoices
router.get("/purchase-invoices", authMiddleware, async (req, res) => {
  const { search } = req.query;
  const conditions: any[] = [eq(purchaseInvoicesTable.isDeleted, "false")];
  if (search) conditions.push(like(purchaseInvoicesTable.partyName, `%${search}%`));

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
  const invoiceNumber = await makeInvoiceNumber("PUR");

  const [invoice] = await db.insert(purchaseInvoicesTable).values({
    invoiceNumber,
    supplierInvoiceNumber: data.supplierInvoiceNumber,
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    isGst: data.isGst ?? true,
    isInterstate: data.isInterstate ?? false,
    isReverseCharge: data.isReverseCharge ?? false,
    subtotal: String(data.subtotal || 0),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    grandTotal: String(data.grandTotal || 0),
    amountPaid: String(data.amountPaid || 0),
    balanceDue: String(data.balanceDue || 0),
    notes: data.notes,
    otherCharges: data.otherCharges || null,
  }).returning();

  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(purchaseInvoiceItemsTable).values({
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
          const newStock = Number(si.physicalStock) + Number(item.quantity);
          await db.update(stockItemsTable).set({ physicalStock: String(newStock) }).where(eq(stockItemsTable.id, item.stockItemId));
          await db.insert(stockTransactionsTable).values({
            itemId: item.stockItemId,
            type: "purchase",
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
      await db.insert(purchaseInvoicePaymentsTable).values({
        invoiceId: invoice.id,
        mode: payment.mode,
        amount: String(payment.amount),
        reference: payment.reference,
      });
    }
  }

  res.status(201).json(invoice);
});

router.get("/purchase-invoices/:id", authMiddleware, async (req, res) => {
  const [invoice] = await db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.id, Number(req.params.id))).limit(1);
  if (!invoice) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(purchaseInvoiceItemsTable).where(eq(purchaseInvoiceItemsTable.invoiceId, Number(req.params.id)));
  const payments = await db.select().from(purchaseInvoicePaymentsTable).where(eq(purchaseInvoicePaymentsTable.invoiceId, Number(req.params.id)));
  res.json({ ...invoice, grandTotal: Number(invoice.grandTotal), items, payments });
});

router.put("/purchase-invoices/:id", authMiddleware, async (req, res) => {
  const data = req.body;
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

  // Replace items
  await db.delete(purchaseInvoiceItemsTable).where(eq(purchaseInvoiceItemsTable.invoiceId, Number(req.params.id)));
  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(purchaseInvoiceItemsTable).values({
        invoiceId: Number(req.params.id),
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
    }
  }

  // Append new payments
  if (data.payments?.length) {
    for (const payment of data.payments) {
      await db.insert(purchaseInvoicePaymentsTable).values({
        invoiceId: Number(req.params.id),
        mode: payment.mode,
        amount: String(payment.amount),
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
      total: String(Number(item.total) || 0),
    });
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
        total: String(Number(item.total) || 0),
      });
    }
  }

  res.json(order);
});

router.delete("/purchase-orders/:id", authMiddleware, async (req, res) => {
  await db.update(purchaseOrdersTable).set({ isDeleted: "true" }).where(eq(purchaseOrdersTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.post("/purchase-orders/:id/cancel", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });
  await db.update(purchaseOrdersTable).set({ status: "cancelled" }).where(eq(purchaseOrdersTable.id, Number(req.params.id)));
  res.json({ ok: true, status: "cancelled" });
});

router.post("/purchase-orders/:id/uncancel", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status !== "cancelled") return res.status(400).json({ error: "Order is not cancelled" });
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

  let anyReceived = false;
  let allReceived = true;
  for (const item of orderItems) {
    const rqty = receivedMap.get(item.id) || 0;
    if (rqty > 0) anyReceived = true;
    if (rqty < Number(item.quantity)) allReceived = false;
  }
  if (!anyReceived) return res.status(400).json({ error: "At least one item must have a received quantity > 0" });

  const newStatus = allReceived ? "received" : "partially_received";
  await db.update(purchaseOrdersTable).set({ status: newStatus }).where(eq(purchaseOrdersTable.id, order.id));

  // Auto-create purchase invoice for received items only
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

    if (item.stockItemId) {
      const [si] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, item.stockItemId)).limit(1);
      if (si) {
        const newStock = Number(si.physicalStock) + item.quantity;
        await db.update(stockItemsTable).set({ physicalStock: String(newStock) }).where(eq(stockItemsTable.id, item.stockItemId));
        await db.insert(stockTransactionsTable).values({
          itemId: item.stockItemId,
          type: "purchase",
          quantity: String(item.quantity),
          balanceAfter: String(newStock),
          reference: invoiceNumber,
        });
      }
    }
  }

  res.json({ ok: true, status: newStatus, invoiceId: invoice.id, invoiceNumber });
});

export default router;
