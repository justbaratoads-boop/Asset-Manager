import { Router } from "express";
import { db } from "@workspace/db";
import { driversTable, vehiclesTable, deliveriesTable, deliveryInvoicesTable } from "@workspace/db/schema";
import { saleInvoicesTable } from "@workspace/db/schema";
import { eq, sql, isNull, or } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { makeVoucherNumber } from "../lib/counter";

const router = Router();

// ── DRIVERS ────────────────────────────────────────────────
router.get("/drivers", authMiddleware, async (_req, res) => {
  const drivers = await db.select().from(driversTable).orderBy(driversTable.name);
  res.json(drivers);
});

router.post("/drivers", authMiddleware, async (req, res) => {
  const { name, phone, licenseNumber, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const [d] = await db.insert(driversTable).values({
    name,
    phone: phone || null,
    licenseNumber: licenseNumber || null,
    notes: notes || null,
  }).returning();
  res.status(201).json(d);
});

router.put("/drivers/:id", authMiddleware, async (req, res) => {
  const { name, phone, licenseNumber, notes } = req.body;
  const [d] = await db.update(driversTable).set({
    name,
    phone: phone || null,
    licenseNumber: licenseNumber || null,
    notes: notes || null,
  }).where(eq(driversTable.id, Number(req.params.id))).returning();
  if (!d) return res.status(404).json({ error: "Not found" });
  res.json(d);
});

router.delete("/drivers/:id", authMiddleware, async (req, res) => {
  await db.delete(driversTable).where(eq(driversTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ── VEHICLES ───────────────────────────────────────────────
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

// ── DELIVERIES ─────────────────────────────────────────────
router.get("/deliveries", authMiddleware, async (_req, res) => {
  const rows = await db
    .select({
      id: deliveriesTable.id,
      challanNumber: deliveriesTable.challanNumber,
      tripNumber: deliveriesTable.tripNumber,
      date: deliveriesTable.date,
      saleInvoiceId: deliveriesTable.saleInvoiceId,
      invoiceNumber: deliveriesTable.invoiceNumber,
      partyName: deliveriesTable.partyName,
      destination: deliveriesTable.destination,
      status: deliveriesTable.status,
      totalAmount: deliveriesTable.totalAmount,
      notes: deliveriesTable.notes,
      createdAt: deliveriesTable.createdAt,
      vehicleId: deliveriesTable.vehicleId,
      driverId: deliveriesTable.driverId,
      // joined
      vehicleNumber: vehiclesTable.vehicleNumber,
      vehicleType: vehiclesTable.type,
      driverName: driversTable.name,
      driverPhone: driversTable.phone,
      invNumber: saleInvoicesTable.invoiceNumber,
      invParty: saleInvoicesTable.partyName,
      invTotal: saleInvoicesTable.grandTotal,
      invDate: saleInvoicesTable.date,
    })
    .from(deliveriesTable)
    .leftJoin(vehiclesTable, eq(deliveriesTable.vehicleId, vehiclesTable.id))
    .leftJoin(driversTable, eq(deliveriesTable.driverId, driversTable.id))
    .leftJoin(saleInvoicesTable, eq(deliveriesTable.saleInvoiceId, saleInvoicesTable.id))
    .orderBy(sql`${deliveriesTable.createdAt} DESC`);

  res.json(rows.map(d => ({
    ...d,
    challanNumber: d.challanNumber || d.tripNumber,
    totalAmount: Number(d.totalAmount),
    // prefer joined invoice info over legacy text fields
    invoiceNumber: d.invNumber || d.invoiceNumber,
    partyName: d.invParty || d.partyName,
  })));
});

router.post("/deliveries", authMiddleware, async (req, res) => {
  const data = req.body;
  const challanNumber = await makeVoucherNumber("CH");

  // If a saleInvoiceId is given, pull invoice info for denormalized fields
  let invoiceNumber = data.invoiceNumber || null;
  let partyName = data.partyName || null;

  if (data.saleInvoiceId) {
    const [inv] = await db
      .select({ invoiceNumber: saleInvoicesTable.invoiceNumber, partyName: saleInvoicesTable.partyName, grandTotal: saleInvoicesTable.grandTotal })
      .from(saleInvoicesTable)
      .where(eq(saleInvoicesTable.id, Number(data.saleInvoiceId)))
      .limit(1);
    if (inv) {
      invoiceNumber = inv.invoiceNumber;
      partyName = inv.partyName;
    }
  }

  const [delivery] = await db.insert(deliveriesTable).values({
    tripNumber: challanNumber,
    challanNumber,
    date: data.date || null,
    saleInvoiceId: data.saleInvoiceId ? Number(data.saleInvoiceId) : null,
    vehicleId: data.vehicleId ? Number(data.vehicleId) : null,
    driverId: data.driverId ? Number(data.driverId) : null,
    invoiceNumber,
    partyName,
    destination: data.destination || null,
    status: "pending",
    totalAmount: String(data.totalAmount || 0),
    notes: data.notes || null,
  }).returning();

  res.status(201).json({ ...delivery, challanNumber: delivery.challanNumber || delivery.tripNumber, totalAmount: Number(delivery.totalAmount) });
});

router.get("/deliveries/:id", authMiddleware, async (req, res) => {
  const [delivery] = await db.select().from(deliveriesTable).where(eq(deliveriesTable.id, Number(req.params.id))).limit(1);
  if (!delivery) return res.status(404).json({ error: "Not found" });
  const invoices = await db.select().from(deliveryInvoicesTable).where(eq(deliveryInvoicesTable.deliveryId, delivery.id));
  res.json({ ...delivery, challanNumber: delivery.challanNumber || delivery.tripNumber, totalAmount: Number(delivery.totalAmount), invoiceIds: invoices.map(i => i.invoiceId) });
});

router.put("/deliveries/:id", authMiddleware, async (req, res) => {
  const updates: Record<string, unknown> = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.notes !== undefined) updates.notes = req.body.notes;
  if (req.body.destination !== undefined) updates.destination = req.body.destination;

  const [delivery] = await db.update(deliveriesTable)
    .set(updates)
    .where(eq(deliveriesTable.id, Number(req.params.id)))
    .returning();
  if (!delivery) return res.status(404).json({ error: "Not found" });
  res.json({ ...delivery, challanNumber: delivery.challanNumber || delivery.tripNumber, totalAmount: Number(delivery.totalAmount) });
});

export default router;
