import { Router } from "express";
import { db } from "@workspace/db";
import {
  partiesTable, saleInvoicesTable, purchaseInvoicesTable,
  paymentsTable, receiptsTable, journalLinesTable, journalEntriesTable,
  ledgersTable
} from "@workspace/db/schema";
import { eq, and, like, sql, or } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/parties", authMiddleware, async (req, res) => {
  const { type, search } = req.query;
  let query = db.select().from(partiesTable).where(eq(partiesTable.isDeleted, "false"));

  const conditions: any[] = [eq(partiesTable.isDeleted, "false")];
  if (type && type !== "all") {
    conditions.push(or(eq(partiesTable.type, type as string), eq(partiesTable.type, "both")));
  }
  if (search) {
    conditions.push(like(partiesTable.name, `%${search}%`));
  }

  const parties = await db.select().from(partiesTable)
    .where(and(...conditions))
    .orderBy(partiesTable.name);

  res.json(parties.map(p => ({
    ...p,
    openingBalance: Number(p.openingBalance),
    creditLimit: p.creditLimit ? Number(p.creditLimit) : null,
  })));
});

router.post("/parties", authMiddleware, async (req, res) => {
  const data = req.body;
  const [party] = await db.insert(partiesTable).values({
    name: data.name,
    type: data.type || "customer",
    address: data.address,
    city: data.city,
    state: data.state,
    pincode: data.pincode,
    gstin: data.gstin,
    pan: data.pan,
    phone: data.phone,
    email: data.email,
    creditLimit: data.creditLimit != null ? String(data.creditLimit) : null,
    openingBalance: String(data.openingBalance || 0),
    balanceType: data.balanceType || "dr",
  }).returning();
  res.status(201).json(party);
});

router.get("/parties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const [party] = await db.select().from(partiesTable).where(eq(partiesTable.id, Number(id))).limit(1);
  if (!party) return res.status(404).json({ error: "Party not found" });
  res.json({ ...party, openingBalance: Number(party.openingBalance), creditLimit: party.creditLimit ? Number(party.creditLimit) : null });
});

router.put("/parties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const [party] = await db.update(partiesTable).set({
    name: data.name,
    type: data.type,
    address: data.address,
    city: data.city,
    state: data.state,
    pincode: data.pincode,
    gstin: data.gstin,
    pan: data.pan,
    phone: data.phone,
    email: data.email,
    creditLimit: data.creditLimit != null ? String(data.creditLimit) : null,
    openingBalance: String(data.openingBalance || 0),
    balanceType: data.balanceType || "dr",
  }).where(eq(partiesTable.id, Number(id))).returning();
  if (!party) return res.status(404).json({ error: "Party not found" });
  res.json(party);
});

router.delete("/parties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await db.update(partiesTable).set({ isDeleted: "true" }).where(eq(partiesTable.id, Number(id)));
  res.json({ ok: true });
});

router.get("/parties/:id/ledger", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query;

  const [party] = await db.select().from(partiesTable).where(eq(partiesTable.id, Number(id))).limit(1);
  if (!party) return res.status(404).json({ error: "Party not found" });

  const transactions: any[] = [];

  const saleInvoices = await db.select({
    date: saleInvoicesTable.date,
    type: sql<string>`'sale_invoice'`,
    description: sql<string>`'Sale Invoice #' || invoice_number`,
    dr: saleInvoicesTable.grandTotal,
    cr: sql<string>`'0'`,
    ref: saleInvoicesTable.invoiceNumber,
  }).from(saleInvoicesTable)
    .where(and(eq(saleInvoicesTable.partyId, Number(id)), eq(saleInvoicesTable.isDeleted, "false")));
  transactions.push(...saleInvoices);

  const rcpts = await db.select({
    date: receiptsTable.date,
    type: sql<string>`'receipt'`,
    description: sql<string>`'Receipt #' || voucher_number`,
    dr: sql<string>`'0'`,
    cr: receiptsTable.amount,
    ref: receiptsTable.voucherNumber,
  }).from(receiptsTable)
    .where(and(eq(receiptsTable.partyId, Number(id)), eq(receiptsTable.isDeleted, "false")));
  transactions.push(...rcpts);

  const sorted = transactions
    .map(t => ({
      ...t,
      dr: Number(t.dr),
      cr: Number(t.cr),
    }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  let balance = Number(party.openingBalance) * (party.balanceType === "dr" ? 1 : -1);
  const rows = sorted.map(t => {
    balance += t.dr - t.cr;
    return { ...t, balance };
  });

  res.json({
    partyId: party.id,
    partyName: party.name,
    openingBalance: Number(party.openingBalance),
    balanceType: party.balanceType,
    transactions: rows,
    closingBalance: balance,
  });
});

export default router;
