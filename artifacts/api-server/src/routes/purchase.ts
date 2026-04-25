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
  const [invoice] = await db.update(purchaseInvoicesTable).set({ notes: req.body.notes }).where(eq(purchaseInvoicesTable.id, Number(req.params.id))).returning();
  if (!invoice) return res.status(404).json({ error: "Not found" });
  res.json(invoice);
});

router.delete("/purchase-invoices/:id", authMiddleware, async (req, res) => {
  await db.update(purchaseInvoicesTable).set({ isDeleted: "true" }).where(eq(purchaseInvoicesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// Purchase orders
router.get("/purchase-orders", authMiddleware, async (req, res) => {
  const conditions: any[] = [eq(purchaseOrdersTable.isDeleted, "false")];
  const orders = await db.select().from(purchaseOrdersTable).where(and(...conditions)).orderBy(sql`created_at DESC`);
  res.json(orders.map(o => ({ ...o, grandTotal: Number(o.grandTotal) })));
});

router.post("/purchase-orders", authMiddleware, async (req, res) => {
  const data = req.body;
  const poNumber = await makeVoucherNumber("PO");
  const [order] = await db.insert(purchaseOrdersTable).values({
    poNumber,
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    status: "open",
    grandTotal: String(data.grandTotal || 0),
    notes: data.notes,
  }).returning();

  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(purchaseOrderItemsTable).values({
        orderId: order.id,
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
  res.status(201).json(order);
});

router.get("/purchase-orders/:id", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.orderId, Number(req.params.id)));
  res.json({ ...order, grandTotal: Number(order.grandTotal), items });
});

router.put("/purchase-orders/:id", authMiddleware, async (req, res) => {
  const [order] = await db.update(purchaseOrdersTable).set({ status: req.body.status }).where(eq(purchaseOrdersTable.id, Number(req.params.id))).returning();
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json(order);
});

router.delete("/purchase-orders/:id", authMiddleware, async (req, res) => {
  await db.update(purchaseOrdersTable).set({ isDeleted: "true" }).where(eq(purchaseOrdersTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.post("/purchase-orders/:id/receive", authMiddleware, async (req, res) => {
  const [order] = await db.update(purchaseOrdersTable).set({ status: "received" }).where(eq(purchaseOrdersTable.id, Number(req.params.id))).returning();
  if (!order) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

export default router;
