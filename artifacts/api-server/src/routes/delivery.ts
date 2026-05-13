import { Router } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, deliveriesTable, deliveryInvoicesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeVoucherNumber } from "../lib/counter";

const router = Router();

router.get("/vehicles", authMiddleware, async (_req, res) => {
  const vehicles = await db.select().from(vehiclesTable).orderBy(vehiclesTable.vehicleNumber);
  res.json(vehicles);
});

router.post("/vehicles", authMiddleware, async (req, res) => {
  const { vehicleNumber, type, ownerName, driverName, driverPhone } = req.body;
  if (!vehicleNumber) return res.status(400).json({ error: "vehicleNumber is required" });
  const [v] = await db.insert(vehiclesTable).values({
    vehicleNumber,
    name: vehicleNumber,
    type: type || null,
    ownerName: ownerName || null,
    driverName: driverName || null,
    driverPhone: driverPhone || null,
  }).returning();
  res.status(201).json(v);
});

router.put("/vehicles/:id", authMiddleware, async (req, res) => {
  const { vehicleNumber, type, ownerName, driverName, driverPhone } = req.body;
  const [v] = await db.update(vehiclesTable).set({
    vehicleNumber,
    name: vehicleNumber,
    type: type || null,
    ownerName: ownerName || null,
    driverName: driverName || null,
    driverPhone: driverPhone || null,
  }).where(eq(vehiclesTable.id, Number(req.params.id))).returning();
  if (!v) return res.status(404).json({ error: "Not found" });
  res.json(v);
});

router.delete("/vehicles/:id", authMiddleware, async (req, res) => {
  await db.delete(vehiclesTable).where(eq(vehiclesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.get("/deliveries", authMiddleware, async (_req, res) => {
  const deliveries = await db.select({
    id: deliveriesTable.id,
    challanNumber: deliveriesTable.challanNumber,
    tripNumber: deliveriesTable.tripNumber,
    date: deliveriesTable.date,
    vehicleId: deliveriesTable.vehicleId,
    invoiceNumber: deliveriesTable.invoiceNumber,
    partyName: deliveriesTable.partyName,
    destination: deliveriesTable.destination,
    status: deliveriesTable.status,
    totalAmount: deliveriesTable.totalAmount,
    notes: deliveriesTable.notes,
    createdAt: deliveriesTable.createdAt,
    vehicleNumber: vehiclesTable.vehicleNumber,
    driverName: vehiclesTable.driverName,
  })
    .from(deliveriesTable)
    .leftJoin(vehiclesTable, eq(deliveriesTable.vehicleId, vehiclesTable.id))
    .orderBy(sql`${deliveriesTable.createdAt} DESC`);

  res.json(deliveries.map(d => ({
    ...d,
    challanNumber: d.challanNumber || d.tripNumber,
    totalAmount: Number(d.totalAmount),
  })));
});

router.post("/deliveries", authMiddleware, async (req, res) => {
  const data = req.body;
  const tripNumber = await makeVoucherNumber("CH");

  const [delivery] = await db.insert(deliveriesTable).values({
    tripNumber,
    challanNumber: tripNumber,
    date: data.date || null,
    vehicleId: data.vehicleId ? Number(data.vehicleId) : null,
    driverId: data.driverId ? Number(data.driverId) : null,
    invoiceNumber: data.invoiceNumber || null,
    partyName: data.partyName || null,
    destination: data.destination || null,
    status: "pending",
    totalAmount: String(data.totalAmount || 0),
    notes: data.notes || null,
  }).returning();

  if (data.invoiceIds?.length) {
    for (const invoiceId of data.invoiceIds) {
      await db.insert(deliveryInvoicesTable).values({ deliveryId: delivery.id, invoiceId });
    }
  }

  res.status(201).json({ ...delivery, challanNumber: delivery.challanNumber || delivery.tripNumber, totalAmount: Number(delivery.totalAmount) });
});

router.get("/deliveries/:id", authMiddleware, async (req, res) => {
  const [delivery] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, Number(req.params.id))).limit(1);
  if (!delivery) return res.status(404).json({ error: "Not found" });
  const invoices = await db.select().from(deliveryInvoicesTable).where(eq(deliveryInvoicesTable.deliveryId, delivery.id));
  res.json({ ...delivery, challanNumber: delivery.challanNumber || delivery.tripNumber, totalAmount: Number(delivery.totalAmount), invoiceIds: invoices.map(i => i.invoiceId) });
});

router.put("/deliveries/:id", authMiddleware, async (req, res) => {
  const [delivery] = await db.update(deliveriesTable).set({
    status: req.body.status,
    notes: req.body.notes,
  }).where(eq(deliveriesTable.id, Number(req.params.id))).returning();
  if (!delivery) return res.status(404).json({ error: "Not found" });
  res.json({ ...delivery, challanNumber: delivery.challanNumber || delivery.tripNumber, totalAmount: Number(delivery.totalAmount) });
});

export default router;
