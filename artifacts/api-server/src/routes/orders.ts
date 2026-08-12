import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, orderItemsTable, saleInvoicesTable, saleInvoiceItemsTable,
  stockItemsTable, stockTransactionsTable, companySettingsTable
} from "@workspace/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeInvoiceNumber, makeVoucherNumber } from "../lib/counter";
import { adjustReservedStock } from "../lib/batch-stock";

const router = Router();

router.get("/orders", authMiddleware, async (req, res) => {
  const { search, status } = req.query;
  const conditions: any[] = [eq(ordersTable.isDeleted, "false")];
  if (search) conditions.push(ilike(ordersTable.partyName, `%${search}%`));
  if (status) conditions.push(eq(ordersTable.status, status as string));

  const orders = await db.select().from(ordersTable)
    .where(and(...conditions))
    .orderBy(sql`created_at DESC`);

  res.json(orders.map(o => ({ ...o, grandTotal: Number(o.grandTotal) })));
});

router.post("/orders", authMiddleware, async (req, res) => {
  const data = req.body;
  if (!data.partyId) return res.status(400).json({ error: "Party is required" });
  if (!data.partyName) return res.status(400).json({ error: "Party name is required" });
  if (!data.items || data.items.length === 0) return res.status(400).json({ error: "At least one item is required" });
  if (!data.date) return res.status(400).json({ error: "Date is required" });
  const orderNumber = await makeVoucherNumber("ORD");

  const [order] = await db.insert(ordersTable).values({
    orderNumber,
    date: data.date,
    partyId: data.partyId,
    partyName: data.partyName,
    partyPhone: data.partyPhone,
    deliveryAddress: data.deliveryAddress,
    notes: data.notes,
    driverName: data.driverName,
    vehicleName: data.vehicleName,
    vehicleNo: data.vehicleNo,
    dispatchNotes: data.dispatchNotes,
    deliveryDate: data.deliveryDate,
    status: "pending",
    grandTotal: String(data.grandTotal || 0),
  }).returning();

  if (data.items?.length) {
    for (const item of data.items) {
      await db.insert(orderItemsTable).values({
        orderId: order.id,
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(item.quantity || 0),
        unit: item.unit,
        rate: String(item.rate || 0),
        discountPct: String(item.discountPct || 0),
        gstPct: String(item.gstPct || 0),
        gstInclusive: item.gstInclusive ?? false,
        taxableAmount: String(item.taxableAmount || 0),
        cgst: String(item.cgst || 0),
        sgst: String(item.sgst || 0),
        igst: String(item.igst || 0),
        batchId: item.batchId || null,
        total: String(item.total || 0),
        description: item.description || null,
      });
      if (item.stockItemId) {
        await adjustReservedStock(item.batchId || null, Number(item.quantity));
      }
    }
  }

  res.status(201).json(order);
});

router.get("/orders/:id", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, Number(req.params.id)));
  res.json({ ...order, grandTotal: Number(order.grandTotal), items: items.map(i => ({ ...i, quantity: Number(i.quantity), rate: Number(i.rate), total: Number(i.total), gstInclusive: i.gstInclusive === true || i.gstInclusive === "true" })) });
});

router.put("/orders/:id", authMiddleware, async (req, res) => {
  const data = req.body;
  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.deliveryAddress !== undefined) updateData.deliveryAddress = data.deliveryAddress;
  if (data.driverName !== undefined) updateData.driverName = data.driverName;
  if (data.vehicleName !== undefined) updateData.vehicleName = data.vehicleName;
  if (data.vehicleNo !== undefined) updateData.vehicleNo = data.vehicleNo;
  if (data.dispatchNotes !== undefined) updateData.dispatchNotes = data.dispatchNotes;
  if (data.deliveryDate !== undefined) updateData.deliveryDate = data.deliveryDate;
  if (data.grandTotal !== undefined) updateData.grandTotal = String(data.grandTotal || 0);

  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, Number(req.params.id))).returning();
  if (!order) return res.status(404).json({ error: "Not found" });

  if (data.items?.length) {
    // Reverse reserved stock for old items before replacing
    const oldItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, Number(req.params.id)));
    for (const oldItem of oldItems) {
      if (oldItem.stockItemId) {
        await adjustReservedStock((oldItem as any).batchId || null, -Number(oldItem.quantity));
      }
    }
    await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, Number(req.params.id)));
    for (const item of data.items) {
      await db.insert(orderItemsTable).values({
        orderId: order.id,
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(item.quantity || 0),
        unit: item.unit,
        rate: String(item.rate || 0),
        discountPct: String(item.discountPct || 0),
        gstPct: String(item.gstPct) || "0",
        gstInclusive: item.gstInclusive ?? false,
        taxableAmount: String(item.taxableAmount || 0),
        cgst: String(item.cgst || 0),
        sgst: String(item.sgst || 0),
        igst: String(item.igst || 0),
        batchId: item.batchId || null,
        total: String(item.total || 0),
        description: item.description || null,
      });
      if (item.stockItemId) {
        await adjustReservedStock(item.batchId || null, Number(item.quantity));
      }
    }
  }

  res.json(order);
});

router.delete("/orders/:id", authMiddleware, async (req, res) => {
  await db.update(ordersTable).set({ isDeleted: "true" }).where(eq(ordersTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

async function convertOrder(req: Request, res: Response) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });

  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const settings = await db.select().from(companySettingsTable).limit(1);
  const prefix = settings[0]?.invoicePrefix || "INV";
  const invoiceNumber = await makeInvoiceNumber(prefix);

  const [invoice] = await db.insert(saleInvoicesTable).values({
    invoiceNumber,
    date: new Date().toISOString().slice(0, 10),
    partyId: order.partyId,
    partyName: order.partyName,
    grandTotal: order.grandTotal,
    balanceDue: order.grandTotal,
    amountPaid: "0",
    status: "confirmed",
  }).returning();

  for (const item of items) {
    await db.insert(saleInvoiceItemsTable).values({
      invoiceId: invoice.id,
      stockItemId: item.stockItemId,
      itemName: item.itemName,
      hsnCode: item.hsnCode,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      discountPct: item.discountPct,
      gstPct: item.gstPct,
      gstInclusive: item.gstInclusive,
      taxableAmount: item.taxableAmount,
      cgst: item.cgst,
      sgst: item.sgst,
      igst: item.igst,
      total: item.total,
    });
  }

  await db.update(ordersTable).set({ status: "dispatched", convertedInvoiceId: invoice.id }).where(eq(ordersTable.id, order.id));

  res.json({ invoiceId: invoice.id, invoiceNumber });
}

router.post("/orders/:id/convert", authMiddleware, convertOrder);
router.post("/orders/:id/convert-to-invoice", authMiddleware, convertOrder);

router.post("/orders/:id/cancel", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  for (const item of items) {
    if (item.stockItemId) {
      await adjustReservedStock((item as any).batchId || null, -Number(item.quantity));
    }
  }
  await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, Number(req.params.id)));
  res.json({ ok: true, status: "cancelled" });
});

router.post("/orders/:id/uncancel", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.status !== "cancelled") return res.status(400).json({ error: "Order is not cancelled" });
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  for (const item of items) {
    if (item.stockItemId) {
      await adjustReservedStock((item as any).batchId || null, Number(item.quantity));
    }
  }
  await db.update(ordersTable).set({ status: "pending" }).where(eq(ordersTable.id, Number(req.params.id)));
  res.json({ ok: true, status: "pending" });
});

export default router;
