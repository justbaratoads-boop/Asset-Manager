import { Router } from "express";
import { db } from "@workspace/db";
import {
  partiesTable, saleInvoicesTable, purchaseInvoicesTable,
  paymentsTable, receiptsTable, journalLinesTable, journalEntriesTable,
  ordersTable, debitNotesTable, creditNotesTable, companySettingsTable
} from "@workspace/db/schema";
import { eq, and, like, sql, or, ne } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

function deriveType(accountGroup: string): string {
  const lower = (accountGroup || "").toLowerCase();
  if (lower.includes("debtor") || lower.includes("customer")) return "customer";
  if (lower.includes("creditor") || lower.includes("supplier")) return "supplier";
  return "both";
}

async function getCompanyState(): Promise<string> {
  const [co] = await db.select({ state: companySettingsTable.state }).from(companySettingsTable).limit(1);
  return co?.state || "";
}

router.get("/parties", authMiddleware, async (req, res) => {
  const { type, search } = req.query;

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
    gstHistory: (() => { try { return JSON.parse(p.gstHistory || "[]"); } catch { return []; } })(),
  })));
});

router.post("/parties", authMiddleware, async (req, res) => {
  const data = req.body;
  const existing = await db.select({ id: partiesTable.id }).from(partiesTable)
    .where(and(eq(partiesTable.name, data.name), eq(partiesTable.isDeleted, "false"))).limit(1);
  if (existing.length > 0) return res.status(409).json({ error: `A party named "${data.name}" already exists` });

  const accountGroup = data.accountGroup || "Sundry Debtors";
  const companyState = await getCompanyState();
  const partyState = data.state || "";
  const isOutOfState = companyState && partyState && companyState !== partyState ? "true" : "false";

  const [party] = await db.insert(partiesTable).values({
    name: data.name,
    type: deriveType(accountGroup),
    accountGroup,
    gstType: data.gstType || "unregistered",
    gstHistory: JSON.stringify(data.gstHistory || []),
    isOutOfState,
    address: data.address,
    city: data.city,
    state: partyState,
    pincode: data.pincode,
    gstin: data.gstType !== "unregistered" ? data.gstin : null,
    pan: data.pan,
    phone: data.phone,
    email: data.email,
    creditLimitEnabled: data.creditLimitEnabled === true || data.creditLimitEnabled === "true" ? "true" : "false",
    creditLimit: data.creditLimitEnabled && data.creditLimit != null ? String(data.creditLimit) : null,
    openingBalance: String(data.openingBalance || 0),
    balanceType: data.balanceType || "dr",
  }).returning();
  res.status(201).json({ ...party, openingBalance: Number(party.openingBalance), gstHistory: data.gstHistory || [] });
});

router.get("/parties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const [party] = await db.select().from(partiesTable).where(eq(partiesTable.id, Number(id))).limit(1);
  if (!party) return res.status(404).json({ error: "Party not found" });
  let gstHistory: any[] = [];
  try { gstHistory = JSON.parse(party.gstHistory || "[]"); } catch {}
  res.json({
    ...party,
    openingBalance: Number(party.openingBalance),
    creditLimit: party.creditLimit ? Number(party.creditLimit) : null,
    gstHistory,
  });
});

router.put("/parties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  if (data.name) {
    const existing = await db.select({ id: partiesTable.id }).from(partiesTable)
      .where(and(eq(partiesTable.name, data.name), eq(partiesTable.isDeleted, "false"), ne(partiesTable.id, Number(id)))).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: `A party named "${data.name}" already exists` });
  }

  const accountGroup = data.accountGroup || "Sundry Debtors";
  const companyState = await getCompanyState();
  const partyState = data.state || "";
  const isOutOfState = companyState && partyState && companyState !== partyState ? "true" : "false";

  const [party] = await db.update(partiesTable).set({
    name: data.name,
    type: deriveType(accountGroup),
    accountGroup,
    gstType: data.gstType,
    gstHistory: JSON.stringify(data.gstHistory || []),
    isOutOfState,
    address: data.address,
    city: data.city,
    state: partyState,
    pincode: data.pincode,
    gstin: data.gstType !== "unregistered" ? data.gstin : null,
    pan: data.pan,
    phone: data.phone,
    email: data.email,
    creditLimitEnabled: data.creditLimitEnabled === true || data.creditLimitEnabled === "true" ? "true" : "false",
    creditLimit: data.creditLimitEnabled && data.creditLimit != null ? String(data.creditLimit) : null,
    openingBalance: String(data.openingBalance || 0),
    balanceType: data.balanceType || "dr",
  }).where(eq(partiesTable.id, Number(id))).returning();
  if (!party) return res.status(404).json({ error: "Party not found" });
  let gstHistory: any[] = [];
  try { gstHistory = JSON.parse(party.gstHistory || "[]"); } catch {}
  res.json({ ...party, openingBalance: Number(party.openingBalance), gstHistory });
});

router.delete("/parties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await db.update(partiesTable).set({ isDeleted: "true" }).where(eq(partiesTable.id, Number(id)));
  res.json({ ok: true });
});

router.get("/parties/:id/ledger", authMiddleware, async (req, res) => {
  const { id } = req.params;

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

  const purchaseInvoices = await db.select({
    date: purchaseInvoicesTable.date,
    type: sql<string>`'purchase_invoice'`,
    description: sql<string>`'Purchase Invoice #' || invoice_number`,
    dr: sql<string>`'0'`,
    cr: purchaseInvoicesTable.grandTotal,
    ref: purchaseInvoicesTable.invoiceNumber,
  }).from(purchaseInvoicesTable)
    .where(and(eq(purchaseInvoicesTable.partyId, Number(id)), eq(purchaseInvoicesTable.isDeleted, "false")));
  transactions.push(...purchaseInvoices);

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

  const pmts = await db.select({
    date: paymentsTable.date,
    type: sql<string>`'payment'`,
    description: sql<string>`'Payment #' || voucher_number`,
    dr: paymentsTable.amount,
    cr: sql<string>`'0'`,
    ref: paymentsTable.voucherNumber,
  }).from(paymentsTable)
    .where(and(eq(paymentsTable.partyId, Number(id)), eq(paymentsTable.isDeleted, "false")));
  transactions.push(...pmts);

  const crNotes = await db.select({
    date: creditNotesTable.date,
    type: sql<string>`'credit_note'`,
    description: sql<string>`'Credit Note #' || note_number`,
    dr: sql<string>`'0'`,
    cr: creditNotesTable.amount,
    ref: creditNotesTable.noteNumber,
  }).from(creditNotesTable)
    .where(and(eq(creditNotesTable.partyId, Number(id)), eq(creditNotesTable.isDeleted, "false")));
  transactions.push(...crNotes);

  const dbNotes = await db.select({
    date: debitNotesTable.date,
    type: sql<string>`'debit_note'`,
    description: sql<string>`'Debit Note #' || note_number`,
    dr: debitNotesTable.amount,
    cr: sql<string>`'0'`,
    ref: debitNotesTable.noteNumber,
  }).from(debitNotesTable)
    .where(and(eq(debitNotesTable.partyId, Number(id)), eq(debitNotesTable.isDeleted, "false")));
  transactions.push(...dbNotes);

  const jLines = await db.select({
    date: journalEntriesTable.date,
    type: sql<string>`'journal'`,
    narration: journalEntriesTable.narration,
    voucherNumber: journalEntriesTable.voucherNumber,
    lineType: journalLinesTable.type,
    amount: journalLinesTable.amount,
  }).from(journalLinesTable)
    .innerJoin(journalEntriesTable, eq(journalLinesTable.entryId, journalEntriesTable.id))
    .where(and(
      eq(journalLinesTable.partyId, Number(id)),
      eq(journalEntriesTable.isDeleted, "false"),
    ));

  for (const jl of jLines) {
    const amt = Number(jl.amount);
    transactions.push({
      date: jl.date,
      type: "journal",
      description: jl.narration || `Journal ${jl.voucherNumber}`,
      dr: jl.lineType === "dr" ? amt : 0,
      cr: jl.lineType === "cr" ? amt : 0,
      ref: jl.voucherNumber,
    });
  }

  const sorted = transactions
    .map(t => ({ ...t, dr: Number(t.dr), cr: Number(t.cr) }))
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

router.get("/parties/:id/orders", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const orders = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.partyId, Number(id)), eq(ordersTable.isDeleted, "false")))
    .orderBy(sql`created_at DESC`);
  res.json(orders.map(o => ({ ...o, grandTotal: Number(o.grandTotal) })));
});

export default router;
