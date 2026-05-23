import { Router } from "express";
import { db } from "@workspace/db";
import {
  ledgersTable, journalEntriesTable, journalLinesTable, paymentsTable, receiptsTable,
  saleInvoicesTable, purchaseInvoicesTable, saleInvoicePaymentsTable, purchaseInvoicePaymentsTable,
} from "@workspace/db/schema";
import { eq, and, ilike, gte, lte, isNotNull, ne } from "drizzle-orm";
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
  const trimmedName = (data.name || "").trim();

  // Revive a soft-deleted ledger only if the name matches exactly and is deleted
  const [softDeleted] = await db.select()
    .from(ledgersTable)
    .where(and(ilike(ledgersTable.name, trimmedName), eq(ledgersTable.isDeleted, "true")))
    .limit(1);

  if (softDeleted) {
    const [revived] = await db.update(ledgersTable).set({
      name: trimmedName,
      group: data.group,
      nature: data.nature || "dr",
      openingBalance: String(data.openingBalance || 0),
      isDeleted: "false",
    }).where(eq(ledgersTable.id, softDeleted.id)).returning();
    return res.status(201).json({ ...revived, openingBalance: Number(revived.openingBalance) });
  }

  const [ledger] = await db.insert(ledgersTable).values({
    name: trimmedName,
    group: data.group,
    nature: data.nature || "dr",
    openingBalance: String(data.openingBalance || 0),
    bankName: data.bankName || null,
    bankBranch: data.bankBranch || null,
    accountNumber: data.accountNumber || null,
    ifscCode: data.ifscCode || null,
    upiId: data.upiId || null,
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
  const [existing] = await db.select().from(ledgersTable).where(eq(ledgersTable.id, Number(id))).limit(1);
  if (!existing) return res.status(404).json({ error: "Ledger not found" });
  if (existing.isSystem === "true") {
    // System ledgers: allow only opening balance and nature (Dr/Cr) to be updated
    const [ledger] = await db.update(ledgersTable).set({
      openingBalance: String(Number(data.openingBalance) || 0),
      nature: data.nature || existing.nature,
    }).where(eq(ledgersTable.id, Number(id))).returning();
    if (!ledger) return res.status(404).json({ error: "Ledger not found" });
    return res.json({ ...ledger, openingBalance: Number(ledger.openingBalance) });
  }

  const [ledger] = await db.update(ledgersTable).set({
    name: data.name,
    group: data.group,
    nature: data.nature,
    openingBalance: String(data.openingBalance || 0),
    bankName: data.bankName ?? null,
    bankBranch: data.bankBranch ?? null,
    accountNumber: data.accountNumber ?? null,
    ifscCode: data.ifscCode ?? null,
    upiId: data.upiId ?? null,
  }).where(eq(ledgersTable.id, Number(id))).returning();
  if (!ledger) return res.status(404).json({ error: "Ledger not found" });
  res.json({ ...ledger, openingBalance: Number(ledger.openingBalance) });
});

router.delete("/ledgers/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const [ledger] = await db.select().from(ledgersTable).where(eq(ledgersTable.id, Number(id))).limit(1);
  if (!ledger) return res.status(404).json({ error: "Ledger not found" });
  if (ledger.isSystem === "true") {
    return res.status(400).json({ error: `"${ledger.name}" is a system ledger and cannot be deleted` });
  }
  await db.update(ledgersTable).set({ isDeleted: "true" }).where(eq(ledgersTable.id, Number(id)));
  res.json({ ok: true });
});

// Helper: map payment mode to a ledger ID (matching the trial balance logic)
function modeToLedgerId(mode: string, allLedgers: { id: number; name: string }[], cashId: number): number {
  const m = (mode || "").toLowerCase();
  if (!m || m === "cash" || m === "upi" || m === "cheque") return cashId;
  return allLedgers.find(l => l.name === mode)?.id ?? cashId;
}

router.get("/ledgers/:id/statement", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query as { from?: string; to?: string };

  const [ledger] = await db.select().from(ledgersTable)
    .where(and(eq(ledgersTable.id, Number(id)), eq(ledgersTable.isDeleted, "false")))
    .limit(1);
  if (!ledger) return res.status(404).json({ error: "Ledger not found" });

  // Fetch all ledgers for mode→id mapping
  const allLedgers = await db.select({ id: ledgersTable.id, name: ledgersTable.name })
    .from(ledgersTable).where(eq(ledgersTable.isDeleted, "false"));
  const cashLedger = allLedgers.find(l => l.name === "Cash");
  const cashId = cashLedger?.id ?? 1;

  const transactions: any[] = [];

  // ── Journal lines ─────────────────────────────────────────────────────────
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

  // ── Payment vouchers (this ledger is the cash/bank account debited) ───────
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

  // ── Receipt vouchers (this ledger is the cash/bank account credited) ──────
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

  // ── Sale invoice other-charges (CR to this ledger — income earned) ────────
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

  // ── Purchase invoice other-charges (DR to this ledger — expense incurred) ─
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

  // ── GST ledger entries from sale/purchase invoices ────────────────────────
  // For CGST Payable / SGST Payable / IGST Payable:
  //   Sale invoice → Cr (output tax collected)
  //   Purchase invoice → Dr (input tax credit)
  const gstField: "totalCgst" | "totalSgst" | "totalIgst" | null =
    (ledger.name === "CGST" || ledger.name === "CGST Payable") ? "totalCgst" :
    (ledger.name === "SGST" || ledger.name === "SGST Payable") ? "totalSgst" :
    (ledger.name === "IGST" || ledger.name === "IGST Payable") ? "totalIgst" : null;

  if (gstField) {
    const salGstConds: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
    if (from) salGstConds.push(gte(saleInvoicesTable.date, from));
    if (to) salGstConds.push(lte(saleInvoicesTable.date, to));

    const saleGstInvs = await db.select({
      date: saleInvoicesTable.date,
      invoiceNumber: saleInvoicesTable.invoiceNumber,
      partyName: saleInvoicesTable.partyName,
      totalCgst: saleInvoicesTable.totalCgst,
      totalSgst: saleInvoicesTable.totalSgst,
      totalIgst: saleInvoicesTable.totalIgst,
    }).from(saleInvoicesTable).where(and(...salGstConds));

    for (const inv of saleGstInvs) {
      const amt = Number(inv[gstField]);
      if (amt > 0) {
        transactions.push({
          date: inv.date,
          type: "sale_invoice",
          description: `Sale Invoice ${inv.invoiceNumber}${inv.partyName ? ` – ${inv.partyName}` : ""}`,
          ref: inv.invoiceNumber,
          dr: 0,
          cr: amt,
        });
      }
    }

    const purGstConds: any[] = [eq(purchaseInvoicesTable.isDeleted, "false")];
    if (from) purGstConds.push(gte(purchaseInvoicesTable.date, from));
    if (to) purGstConds.push(lte(purchaseInvoicesTable.date, to));

    const purchGstInvs = await db.select({
      date: purchaseInvoicesTable.date,
      invoiceNumber: purchaseInvoicesTable.invoiceNumber,
      partyName: purchaseInvoicesTable.partyName,
      totalCgst: purchaseInvoicesTable.totalCgst,
      totalSgst: purchaseInvoicesTable.totalSgst,
      totalIgst: purchaseInvoicesTable.totalIgst,
    }).from(purchaseInvoicesTable).where(and(...purGstConds));

    for (const inv of purchGstInvs) {
      const amt = Number(inv[gstField]);
      if (amt > 0) {
        transactions.push({
          date: inv.date,
          type: "purchase_invoice",
          description: `Purchase Invoice ${inv.invoiceNumber}${inv.partyName ? ` – ${inv.partyName}` : ""}`,
          ref: inv.invoiceNumber,
          dr: amt,
          cr: 0,
        });
      }
    }
  }

  // ── Cash / Bank ledger: inline sale and purchase invoice payments ─────────
  // Show payments that were routed to this specific ledger via modeToLedgerId.
  // We fetch all and filter in memory, as mode→ledger mapping requires the full ledger list.
  const thisMapsHere = (mode: string) => modeToLedgerId(mode, allLedgers, cashId) === Number(id);

  const salePmtJoinConds: any[] = [
    eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id),
    eq(saleInvoicesTable.isDeleted, "false"),
  ];
  if (from) salePmtJoinConds.push(gte(saleInvoicesTable.date, from));
  if (to) salePmtJoinConds.push(lte(saleInvoicesTable.date, to));

  const salePayments = await db.select({
    date: saleInvoicesTable.date,
    invoiceNumber: saleInvoicesTable.invoiceNumber,
    partyName: saleInvoicesTable.partyName,
    mode: saleInvoicePaymentsTable.mode,
    amount: saleInvoicePaymentsTable.amount,
  }).from(saleInvoicePaymentsTable)
    .innerJoin(saleInvoicesTable, and(...salePmtJoinConds));

  for (const p of salePayments) {
    if (!thisMapsHere(p.mode)) continue;
    transactions.push({
      date: p.date,
      type: "sale_invoice",
      description: `Sale Invoice ${p.invoiceNumber}${p.partyName ? ` – ${p.partyName}` : ""}`,
      ref: p.invoiceNumber,
      dr: Number(p.amount),
      cr: 0,
    });
  }

  const purchPmtJoinConds: any[] = [
    eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id),
    eq(purchaseInvoicesTable.isDeleted, "false"),
  ];
  if (from) purchPmtJoinConds.push(gte(purchaseInvoicesTable.date, from));
  if (to) purchPmtJoinConds.push(lte(purchaseInvoicesTable.date, to));

  const purchPayments = await db.select({
    date: purchaseInvoicesTable.date,
    invoiceNumber: purchaseInvoicesTable.invoiceNumber,
    partyName: purchaseInvoicesTable.partyName,
    mode: purchaseInvoicePaymentsTable.mode,
    amount: purchaseInvoicePaymentsTable.amount,
  }).from(purchaseInvoicePaymentsTable)
    .innerJoin(purchaseInvoicesTable, and(...purchPmtJoinConds));

  for (const p of purchPayments) {
    if (!thisMapsHere(p.mode)) continue;
    transactions.push({
      date: p.date,
      type: "purchase_invoice",
      description: `Purchase Invoice ${p.invoiceNumber}${p.partyName ? ` – ${p.partyName}` : ""}`,
      ref: p.invoiceNumber,
      dr: 0,
      cr: Number(p.amount),
    });
  }

  const sorted = transactions.sort((a, b) => a.date.localeCompare(b.date));

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
    isSystem: ledger.isSystem,
    openingBalance: Number(ledger.openingBalance),
    transactions: rows,
    totalDr,
    totalCr,
    closingBalance: balance,
  });
});

export default router;
