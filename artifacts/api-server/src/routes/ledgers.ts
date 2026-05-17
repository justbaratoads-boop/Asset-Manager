import { Router } from "express";
import { db } from "@workspace/db";
import { ledgersTable, journalEntriesTable, journalLinesTable, paymentsTable, receiptsTable, saleInvoicesTable, purchaseInvoicesTable } from "@workspace/db/schema";
import { eq, and, ilike, gte, lte, isNotNull } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/ledgers", authMiddleware, async (req, res) => {
  const { group, search } = req.query;
  const conditions: any[] = [eq(ledgersTable.isDeleted, "false")];
  if (group) conditions.push(eq(ledgersTable.group, group as string));
  if (search) conditions.push(ilike(ledgersTable.name, `%${search}%`));

  const ledgers = await db.select().from(ledgersTable)
    .where(and(...conditions))
    .orderBy(ledgersTable.group, ledgersTable.name);

  res.json(ledgers.map(l => ({ ...l, openingBalance: Number(l.openingBalance) })));
});

router.post("/ledgers", authMiddleware, async (req, res) => {
  const data = req.body;
  const [ledger] = await db.insert(ledgersTable).values({
    name: data.name,
    group: data.group,
    nature: data.nature || "dr",
    openingBalance: String(data.openingBalance || 0),
  }).returning();
  res.status(201).json({ ...ledger, openingBalance: Number(ledger.openingBalance) });
});

router.get("/ledgers/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const [ledger] = await db.select().from(ledgersTable).where(eq(ledgersTable.id, Number(id))).limit(1);
  if (!ledger) return res.status(404).json({ error: "Ledger not found" });
  res.json({ ...ledger, openingBalance: Number(ledger.openingBalance) });
});

router.put("/ledgers/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const [ledger] = await db.update(ledgersTable).set({
    name: data.name,
    group: data.group,
    nature: data.nature,
    openingBalance: String(data.openingBalance || 0),
  }).where(eq(ledgersTable.id, Number(id))).returning();
  if (!ledger) return res.status(404).json({ error: "Ledger not found" });
  res.json({ ...ledger, openingBalance: Number(ledger.openingBalance) });
});

router.delete("/ledgers/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  await db.update(ledgersTable).set({ isDeleted: "true" }).where(eq(ledgersTable.id, Number(id)));
  res.json({ ok: true });
});

router.get("/ledgers/:id/statement", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query as { from?: string; to?: string };

  const [ledger] = await db.select().from(ledgersTable)
    .where(and(eq(ledgersTable.id, Number(id)), eq(ledgersTable.isDeleted, "false")))
    .limit(1);
  if (!ledger) return res.status(404).json({ error: "Ledger not found" });

  const transactions: any[] = [];

  // Journal lines
  const jConds: any[] = [
    eq(journalLinesTable.ledgerId, Number(id)),
    eq(journalEntriesTable.isDeleted, "false"),
  ];
  if (from) jConds.push(gte(journalEntriesTable.date, from));
  if (to) jConds.push(lte(journalEntriesTable.date, to));

  const jLines = await db.select({
    date: journalEntriesTable.date,
    narration: journalEntriesTable.narration,
    ref: journalEntriesTable.voucherNumber,
    lineType: journalLinesTable.type,
    amount: journalLinesTable.amount,
  }).from(journalLinesTable)
    .innerJoin(journalEntriesTable, eq(journalLinesTable.entryId, journalEntriesTable.id))
    .where(and(...jConds));

  for (const jl of jLines) {
    const amt = Number(jl.amount);
    transactions.push({
      date: jl.date,
      type: "journal",
      description: jl.narration || `Journal ${jl.ref}`,
      ref: jl.ref,
      dr: jl.lineType === "dr" ? amt : 0,
      cr: jl.lineType === "cr" ? amt : 0,
    });
  }

  // Payment vouchers (this ledger is the cash/bank account debited)
  const pmtConds: any[] = [
    eq(paymentsTable.ledgerId, Number(id)),
    eq(paymentsTable.isDeleted, "false"),
  ];
  if (from) pmtConds.push(gte(paymentsTable.date, from));
  if (to) pmtConds.push(lte(paymentsTable.date, to));

  const pmts = await db.select().from(paymentsTable).where(and(...pmtConds));
  for (const p of pmts) {
    transactions.push({
      date: p.date,
      type: "payment",
      description: p.narration || (p.partyName ? `Payment to ${p.partyName}` : `Payment ${p.voucherNumber}`),
      ref: p.voucherNumber,
      dr: 0,
      cr: Number(p.amount),
    });
  }

  // Receipt vouchers (this ledger is the cash/bank account credited)
  const rcptConds: any[] = [
    eq(receiptsTable.ledgerId, Number(id)),
    eq(receiptsTable.isDeleted, "false"),
  ];
  if (from) rcptConds.push(gte(receiptsTable.date, from));
  if (to) rcptConds.push(lte(receiptsTable.date, to));

  const rcpts = await db.select().from(receiptsTable).where(and(...rcptConds));
  for (const r of rcpts) {
    transactions.push({
      date: r.date,
      type: "receipt",
      description: r.narration || (r.partyName ? `Receipt from ${r.partyName}` : `Receipt ${r.voucherNumber}`),
      ref: r.voucherNumber,
      dr: Number(r.amount),
      cr: 0,
    });
  }

  // Sale invoice additional fields (CR to this ledger — income earned)
  const saleConds: any[] = [
    isNotNull(saleInvoicesTable.otherCharges),
    eq(saleInvoicesTable.isDeleted, "false"),
  ];
  if (from) saleConds.push(gte(saleInvoicesTable.date, from));
  if (to) saleConds.push(lte(saleInvoicesTable.date, to));

  const saleInvs = await db.select({
    date: saleInvoicesTable.date,
    invoiceNumber: saleInvoicesTable.invoiceNumber,
    partyName: saleInvoicesTable.partyName,
    otherCharges: saleInvoicesTable.otherCharges,
  }).from(saleInvoicesTable).where(and(...saleConds));

  for (const inv of saleInvs) {
    try {
      const charges = JSON.parse(inv.otherCharges as string || "[]");
      for (const charge of charges) {
        if (typeof charge.ledgerId === "number" && charge.ledgerId === Number(id) && Number(charge.amount) > 0) {
          transactions.push({
            date: inv.date,
            type: "sale_invoice",
            description: `Sale Invoice ${inv.invoiceNumber}${inv.partyName ? ` – ${inv.partyName}` : ""}`,
            ref: inv.invoiceNumber,
            dr: 0,
            cr: Number(charge.amount),
          });
        }
      }
    } catch {}
  }

  // Purchase invoice additional fields (DR to this ledger — expense incurred)
  const purchConds: any[] = [
    isNotNull(purchaseInvoicesTable.otherCharges),
    eq(purchaseInvoicesTable.isDeleted, "false"),
  ];
  if (from) purchConds.push(gte(purchaseInvoicesTable.date, from));
  if (to) purchConds.push(lte(purchaseInvoicesTable.date, to));

  const purchInvs = await db.select({
    date: purchaseInvoicesTable.date,
    invoiceNumber: purchaseInvoicesTable.invoiceNumber,
    partyName: purchaseInvoicesTable.partyName,
    otherCharges: purchaseInvoicesTable.otherCharges,
  }).from(purchaseInvoicesTable).where(and(...purchConds));

  for (const inv of purchInvs) {
    try {
      const charges = JSON.parse(inv.otherCharges as string || "[]");
      for (const charge of charges) {
        if (typeof charge.ledgerId === "number" && charge.ledgerId === Number(id) && Number(charge.amount) > 0) {
          transactions.push({
            date: inv.date,
            type: "purchase_invoice",
            description: `Purchase Invoice ${inv.invoiceNumber}${inv.partyName ? ` – ${inv.partyName}` : ""}`,
            ref: inv.invoiceNumber,
            dr: Number(charge.amount),
            cr: 0,
          });
        }
      }
    } catch {}
  }

  const sorted = transactions.sort((a, b) => a.date.localeCompare(b.date));

  // Dr-nature ledger: opening balance is positive Dr; Cr-nature: negative (Cr side)
  let balance = Number(ledger.openingBalance) * (ledger.nature === "cr" ? -1 : 1);
  const rows = sorted.map(t => {
    balance += t.dr - t.cr;
    return { ...t, balance };
  });

  const totalDr = rows.reduce((s: number, t: any) => s + t.dr, 0);
  const totalCr = rows.reduce((s: number, t: any) => s + t.cr, 0);

  res.json({
    ledgerId: Number(ledger.id),
    ledgerName: ledger.name,
    group: ledger.group,
    nature: ledger.nature,
    openingBalance: Number(ledger.openingBalance),
    transactions: rows,
    totalDr,
    totalCr,
    closingBalance: balance,
  });
});

export default router;
