import { Router } from "express";
import { db } from "@workspace/db";
import { driversTable, vehiclesTable, deliveriesTable, deliveryInvoicesTable } from "@workspace/db/schema";
import { saleInvoicesTable, saleInvoiceItemsTable } from "@workspace/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
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

  const deliveryIds = rows.map(r => r.id);
  let linkedInvoices: any[] = [];
  if (deliveryIds.length > 0) {
    linkedInvoices = await db
      .select({
        deliveryId: deliveryInvoicesTable.deliveryId,
        invoiceId: deliveryInvoicesTable.invoiceId,
        invoiceNumber: saleInvoicesTable.invoiceNumber,
        partyName: saleInvoicesTable.partyName,
        grandTotal: saleInvoicesTable.grandTotal,
      })
      .from(deliveryInvoicesTable)
      .innerJoin(saleInvoicesTable, eq(deliveryInvoicesTable.invoiceId, saleInvoicesTable.id))
      .where(inArray(deliveryInvoicesTable.deliveryId, deliveryIds));
  }

  const linkedMap = new Map<number, any[]>();
  for (const item of linkedInvoices) {
    if (!linkedMap.has(item.deliveryId)) linkedMap.set(item.deliveryId, []);
    linkedMap.get(item.deliveryId)!.push(item);
  }

  res.json(rows.map(d => {
    const attached = linkedMap.get(d.id) || [];
    let invoiceNumber = d.invoiceNumber || d.invNumber || "-";
    let partyName = d.partyName || d.invParty || "-";
    let totalAmount = Number(d.totalAmount) || 0;
    let invoiceIds: number[] = attached.map(a => a.invoiceId);

    if (d.saleInvoiceId && !invoiceIds.includes(d.saleInvoiceId)) {
      invoiceIds.push(d.saleInvoiceId);
    }

    if (attached.length > 0) {
      invoiceNumber = attached.map(a => a.invoiceNumber).filter(Boolean).join(", ");
      const parties = Array.from(new Set(attached.map(a => a.partyName).filter(Boolean)));
      partyName = parties.join(", ");
      totalAmount = attached.reduce((sum, a) => sum + Number(a.grandTotal || 0), 0);
    }

    return {
      ...d,
      challanNumber: d.challanNumber || d.tripNumber,
      invoiceNumber,
      partyName,
      totalAmount,
      invoiceIds,
      invoices: attached.map(a => ({
        id: a.invoiceId,
        invoiceNumber: a.invoiceNumber,
        partyName: a.partyName,
        grandTotal: Number(a.grandTotal),
      })),
    };
  }));
});

router.post("/deliveries", authMiddleware, async (req, res) => {
  const data = req.body;
  const challanNumber = await makeVoucherNumber("CH");

  let invoiceIds: number[] = [];
  if (Array.isArray(data.saleInvoiceIds) && data.saleInvoiceIds.length > 0) {
    invoiceIds = data.saleInvoiceIds.map(Number);
  } else if (data.saleInvoiceId) {
    invoiceIds = [Number(data.saleInvoiceId)];
  }

  let invoiceNumber = data.invoiceNumber || null;
  let partyName = data.partyName || null;
  let totalAmount = Number(data.totalAmount || 0);

  if (invoiceIds.length > 0) {
    const invs = await db
      .select({ id: saleInvoicesTable.id, invoiceNumber: saleInvoicesTable.invoiceNumber, partyName: saleInvoicesTable.partyName, grandTotal: saleInvoicesTable.grandTotal })
      .from(saleInvoicesTable)
      .where(inArray(saleInvoicesTable.id, invoiceIds));

    if (invs.length > 0) {
      invoiceNumber = invs.map(i => i.invoiceNumber).filter(Boolean).join(", ");
      const uniqueParties = Array.from(new Set(invs.map(i => i.partyName).filter(Boolean)));
      partyName = uniqueParties.join(", ");
      totalAmount = invs.reduce((sum, i) => sum + Number(i.grandTotal || 0), 0);
    }
  }

  const [delivery] = await db.insert(deliveriesTable).values({
    tripNumber: challanNumber,
    challanNumber,
    date: data.date || null,
    saleInvoiceId: invoiceIds.length > 0 ? invoiceIds[0] : null,
    vehicleId: data.vehicleId ? Number(data.vehicleId) : null,
    driverId: data.driverId ? Number(data.driverId) : null,
    invoiceNumber,
    partyName,
    destination: data.destination || null,
    status: "pending",
    totalAmount: String(totalAmount),
    notes: data.notes || null,
  }).returning();

  if (delivery && invoiceIds.length > 0) {
    await db.insert(deliveryInvoicesTable).values(
      invoiceIds.map(invId => ({
        deliveryId: delivery.id,
        invoiceId: invId,
      }))
    );
  }

  res.status(201).json({
    ...delivery,
    challanNumber: delivery.challanNumber || delivery.tripNumber,
    totalAmount,
    invoiceIds,
  });
});

router.get("/deliveries/:id", authMiddleware, async (req, res) => {
  const [delivery] = await db
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
      vehicleNumber: vehiclesTable.vehicleNumber,
      vehicleType: vehiclesTable.type,
      driverName: driversTable.name,
      driverPhone: driversTable.phone,
    })
    .from(deliveriesTable)
    .leftJoin(vehiclesTable, eq(deliveriesTable.vehicleId, vehiclesTable.id))
    .leftJoin(driversTable, eq(deliveriesTable.driverId, driversTable.id))
    .where(eq(deliveriesTable.id, Number(req.params.id)))
    .limit(1);

  if (!delivery) return res.status(404).json({ error: "Not found" });

  const linkedRecords = await db
    .select({ invoiceId: deliveryInvoicesTable.invoiceId })
    .from(deliveryInvoicesTable)
    .where(eq(deliveryInvoicesTable.deliveryId, delivery.id));

  let allInvoiceIds = linkedRecords.map(r => r.invoiceId);
  if (delivery.saleInvoiceId && !allInvoiceIds.includes(delivery.saleInvoiceId)) {
    allInvoiceIds.push(delivery.saleInvoiceId);
  }

  let invoicesWithItems: any[] = [];
  if (allInvoiceIds.length > 0) {
    const invRows = await db
      .select({
        id: saleInvoicesTable.id,
        invoiceNumber: saleInvoicesTable.invoiceNumber,
        partyName: saleInvoicesTable.partyName,
        partyId: saleInvoicesTable.partyId,
        date: saleInvoicesTable.date,
        grandTotal: saleInvoicesTable.grandTotal,
        amountPaid: saleInvoicesTable.amountPaid,
        balanceDue: saleInvoicesTable.balanceDue,
        notes: saleInvoicesTable.notes,
      })
      .from(saleInvoicesTable)
      .where(inArray(saleInvoicesTable.id, allInvoiceIds));

    for (const inv of invRows) {
      const items = await db
        .select({
          id: saleInvoiceItemsTable.id,
          itemName: saleInvoiceItemsTable.itemName,
          quantity: saleInvoiceItemsTable.quantity,
          unit: saleInvoiceItemsTable.unit,
          rate: saleInvoiceItemsTable.rate,
          total: saleInvoiceItemsTable.total,
          discountPct: saleInvoiceItemsTable.discountPct,
          gstPct: saleInvoiceItemsTable.gstPct,
        })
        .from(saleInvoiceItemsTable)
        .where(eq(saleInvoiceItemsTable.invoiceId, inv.id));

      invoicesWithItems.push({
        ...inv,
        grandTotal: Number(inv.grandTotal),
        amountPaid: Number(inv.amountPaid),
        balanceDue: Number(inv.balanceDue),
        items: items.map(i => ({
          ...i,
          quantity: Number(i.quantity) || 0,
          rate: Number(i.rate) || 0,
          total: Number(i.total) || 0,
        })),
      });
    }
  }

  res.json({
    ...delivery,
    challanNumber: delivery.challanNumber || delivery.tripNumber,
    totalAmount: Number(delivery.totalAmount),
    invoiceIds: allInvoiceIds,
    invoices: invoicesWithItems,
  });
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
