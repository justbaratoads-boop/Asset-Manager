import { Router } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, deliveriesTable, deliveryInvoicesTable, usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeVoucherNumber } from "../lib/counter";

const router = Router();

router.get("/vehicles", authMiddleware, async (_req, res) => {
  const vehicles = await db.select().from(vehiclesTable).orderBy(vehiclesTable.name);
  res.json(vehicles);
});

router.post("/vehicles", authMiddleware, async (req, res) => {
  const [v] = await db.insert(vehiclesTable).values({
    vehicleNumber: req.body.vehicleNumber,
    name: req.body.name,
    driverUserId: req.body.driverUserId,
  }).returning();
  res.status(201).json(v);
});

router.put("/vehicles/:id", authMiddleware, async (req, res) => {
  const [v] = await db.update(vehiclesTable).set({
    vehicleNumber: req.body.vehicleNumber,
    name: req.body.name,
    driverUserId: req.body.driverUserId,
  }).where(eq(vehiclesTable.id, Number(req.params.id))).returning();
  if (!v) return res.status(404).json({ error: "Not found" });
  res.json(v);
});

router.delete("/vehicles/:id", authMiddleware, async (req, res) => {
  await db.delete(vehiclesTable).where(eq(vehiclesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.get("/deliveries", authMiddleware, async (_req, res) => {
  const deliveries = await db.select().from(deliveriesTable).orderBy(sql`created_at DESC`);
  res.json(deliveries.map(d => ({ ...d, totalAmount: Number(d.totalAmount) })));
});

router.post("/deliveries", authMiddleware, async (req, res) => {
  const data = req.body;
  const tripNumber = await makeVoucherNumber("TRP");

  const [delivery] = await db.insert(deliveriesTable).values({
    tripNumber,
    driverId: data.driverId,
    vehicleId: data.vehicleId,
    status: "pending",
    totalAmount: String(data.totalAmount || 0),
    notes: data.notes,
  }).returning();

  if (data.invoiceIds?.length) {
    for (const invoiceId of data.invoiceIds) {
      await db.insert(deliveryInvoicesTable).values({ deliveryId: delivery.id, invoiceId });
    }
  }

  res.status(201).json(delivery);
});

router.get("/deliveries/:id", authMiddleware, async (req, res) => {
  const [delivery] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, Number(req.params.id))).limit(1);
  if (!delivery) return res.status(404).json({ error: "Not found" });
  const invoices = await db.select().from(deliveryInvoicesTable).where(eq(deliveryInvoicesTable.deliveryId, delivery.id));
  res.json({ ...delivery, totalAmount: Number(delivery.totalAmount), invoiceIds: invoices.map(i => i.invoiceId) });
});

router.put("/deliveries/:id", authMiddleware, async (req, res) => {
  const [delivery] = await db.update(deliveriesTable).set({
    status: req.body.status,
    notes: req.body.notes,
  }).where(eq(deliveriesTable.id, Number(req.params.id))).returning();
  if (!delivery) return res.status(404).json({ error: "Not found" });
  res.json(delivery);
});

export default router;
