import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  ordersTable, orderItemsTable, saleInvoicesTable, saleInvoiceItemsTable,
  stockItemsTable, stockTransactionsTable, companySettingsTable
} from "@workspace/db/schema";
import { eq, and, like, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeInvoiceNumber, makeVoucherNumber } from "../lib/counter";

const router = Router();

router.get("/orders", authMiddleware, async (req, res) => {
  const { search, status } = req.query;
  const conditions: any[] = [eq(ordersTable.isDeleted, "false")];
  if (search) conditions.push(like(ordersTable.partyName, `%${search}%`));
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

router.get("/orders/:id", authMiddleware, async (req, res) => {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(req.params.id))).limit(1);
  if (!order) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, Number(req.params.id)));
  res.json({ ...order, grandTotal: Number(order.grandTotal), items: items.map(i => ({ ...i, quantity: Number(i.quantity), rate: Number(i.rate), total: Number(i.total) })) });
});

router.put("/orders/:id", authMiddleware, async (req, res) => {
  const data = req.body;
  const [order] = await db.update(ordersTable).set({
    status: data.status,
    notes: data.notes,
    deliveryAddress: data.deliveryAddress,
    driverName: data.driverName,
    vehicleName: data.vehicleName,
    vehicleNo: data.vehicleNo,
    dispatchNotes: data.dispatchNotes,
    deliveryDate: data.deliveryDate,
  }).where(eq(ordersTable.id, Number(req.params.id))).returning();
  if (!order) return res.status(404).json({ error: "Not found" });
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

export default router;
