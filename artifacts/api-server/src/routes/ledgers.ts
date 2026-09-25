import { Router } from "express";
import { db } from "@workspace/db";
import {
  ledgersTable, journalEntriesTable, journalLinesTable, paymentsTable, receiptsTable,
  saleInvoicesTable, purchaseInvoicesTable, saleInvoicePaymentsTable, purchaseInvoicePaymentsTable,
  partiesTable, creditNotesTable, debitNotesTable,
} from "@workspace/db/schema";
import { eq, and, ilike, gte, lte, isNotNull, ne } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/ledgers", authMiddleware, async (req, res) => {
  // Auto-heal Round Off ledger for any tenant that didn't restart their server
  try {
    const [existingRoundOff] = await db.select().from(ledgersTable)
      .where(and(eq(ledgersTable.name, "Round Off"), eq(ledgersTable.isDeleted, "false")))
      .limit(1);
    if (!existingRoundOff) {
      await db.insert(ledgersTable).values({
        name: "Round Off", group: "Indirect Expenses", nature: "dr",
        openingBalance: "0", isSystem: "true",
      });
    }
  } catch (e) {
    console.error("Auto-heal Round Off failed:", e);
  }

  const { group, search } = req.query;
  const conditions: any[] = [eq(ledgersTable.isDeleted, "false")];
  if (group) conditions.push(eq(ledgersTable.group, group as string));
  if (search) conditions.push(ilike(ledgersTable.name, `%${search}%`));

  const ledgers = await db.select().from(ledgersTable)
    .where(and(...conditions))
    .orderBy(ledgersTable.name);

  // Inject parties as ledgers for the Chart of Accounts tree
  const partyConds: any[] = [eq(partiesTable.isDeleted, "false")];
  if (search) partyConds.push(ilike(partiesTable.name, `%${search}%`));
  
  const parties = await db.select().from(partiesTable).where(and(...partyConds));
  
  const partyLedgers = parties.map(p => {
    let pGroup = p.accountGroup || (p.type === "supplier" ? "Sundry Creditors" : "Sundry Debtors");
    return {
      id: 1000000 + p.id,
      name: p.name,
      group: pGroup,
      nature: p.type === "supplier" ? "cr" : "dr",
      openingBalance: p.openingBalance,
      isSystem: "true", // Prevent editing from COA
      gstCalculationMethod: "none",
      isDeleted: p.isDeleted,
      createdAt: p.createdAt
    };
  });

  const combined = [...ledgers, ...partyLedgers];
  const filteredCombined = group ? combined.filter(l => l.group === group) : combined;

  res.json(filteredCombined.map((l: any) => ({ ...l, openingBalance: Number(l.openingBalance) })));
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
      isGstApplicable: data.isGstApplicable || false,
      gstCalculationMethod: data.gstCalculationMethod || "none",
      gstRate: data.gstRate || null,
      hsnSac: data.hsnSac || null,
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
    isGstApplicable: data.isGstApplicable || false,
    gstCalculationMethod: data.gstCalculationMethod || "none",
    gstRate: data.gstRate || null,
    hsnSac: data.hsnSac || null,
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
    isGstApplicable: data.isGstApplicable ?? false,
    gstCalculationMethod: data.gstCalculationMethod ?? "none",
    gstRate: data.gstRate || null,
    hsnSac: data.hsnSac || null,
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

  // Block delete if transactions exist for this ledger
  const [jLine] = await db.select({ id: journalLinesTable.id }).from(journalLinesTable).where(eq(journalLinesTable.ledgerId, Number(id))).limit(1);
  const [pmt] = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(and(eq(paymentsTable.ledgerId, Number(id)), eq(paymentsTable.isDeleted, "false"))).limit(1);
  const [rcpt] = await db.select({ id: receiptsTable.id }).from(receiptsTable).where(and(eq(receiptsTable.ledgerId, Number(id)), eq(receiptsTable.isDeleted, "false"))).limit(1);
  if (jLine || pmt || rcpt) {
    return res.status(400).json({ error: `"${ledger.name}" has transactions and cannot be deleted`, code: "HAS_TRANSACTIONS" });
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

  const allLedgers = await db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false"));
  const cashLedger = allLedgers.find(l => l.name.toLowerCase() === "cash" || l.name.toLowerCase() === "cash in hand");
  const cashId = cashLedger?.id ?? 0;

  // Try to find a party that matches the ledger's name
  const [matchingParty] = await db.select().from(partiesTable)
    .where(and(eq(partiesTable.name, ledger.name), eq(partiesTable.isDeleted, "false")))
    .limit(1);
  const matchingPartyId = matchingParty?.id;

  const lGroupLower = (ledger.group || "").toLowerCase();
  const lNameLower = (ledger.name || "").toLowerCase();
  const isSalesLedger = lGroupLower === "sales accounts" || lNameLower === "sales account" || lNameLower === "sale account";
  const isPurchaseLedger = lGroupLower === "purchase accounts" || lNameLower === "purchase account";

  const allTransactions: any[] = [];

  // ── 1. Journal lines ─────────────────────────────────────────────────────────
  const jConds: any[] = [
    eq(journalLinesTable.ledgerId, Number(id)),
    eq(journalEntriesTable.isDeleted, "false"),
  ];
  if (to) jConds.push(lte(journalEntriesTable.date, to));

  const jLines = await db.select({
    id: journalEntriesTable.id,
    date: journalEntriesTable.date,
    narration: journalEntriesTable.narration,
    ref: journalEntriesTable.voucherNumber,
    voucherType: journalEntriesTable.voucherType,
    lineType: journalLinesTable.type,
    amount: journalLinesTable.amount,
  }).from(journalLinesTable)
    .innerJoin(journalEntriesTable, eq(journalLinesTable.entryId, journalEntriesTable.id))
    .where(and(...jConds));

  // Query payments and receipts upfront to correlate JL- allocations with the voucher IDs
  const pmtConds: any[] = [eq(paymentsTable.isDeleted, "false")];
  if (to) pmtConds.push(lte(paymentsTable.date, to));
  const pmts = await db.select().from(paymentsTable).where(and(...pmtConds));
  const paymentByVoucher = new Map<string, number>();
  pmts.forEach(p => paymentByVoucher.set(p.voucherNumber, p.id));

  const rcptConds: any[] = [eq(receiptsTable.isDeleted, "false")];
  if (to) rcptConds.push(lte(receiptsTable.date, to));
  const rcpts = await db.select().from(receiptsTable).where(and(...rcptConds));
  const receiptByVoucher = new Map<string, number>();
  rcpts.forEach(r => receiptByVoucher.set(r.voucherNumber, r.id));

  for (const jl of jLines) {
    const amt = Number(jl.amount);
    // JL- prefixed entries are auto-generated from payment/receipt multi-ledger splits
    const isPaymentAlloc = (jl.voucherType === "payment");
    const isReceiptAlloc = (jl.voucherType === "receipt");
    const realRef = jl.ref.startsWith("JL-") ? jl.ref.slice(3) : jl.ref;
    const pmtId = isPaymentAlloc ? paymentByVoucher.get(realRef) : undefined;
    const rcptId = isReceiptAlloc ? receiptByVoucher.get(realRef) : undefined;
    allTransactions.push({
      id: pmtId || rcptId || jl.id,
      date: jl.date,
      type: isPaymentAlloc ? "payment" : isReceiptAlloc ? "receipt" : "journal",
      description: jl.narration || '',
      ref: realRef,
      dr: jl.lineType === "dr" ? amt : 0,
      cr: jl.lineType === "cr" ? amt : 0,
    });
  }

  // ── 2. Payment vouchers ──────────────────────────────────────────────────────
  for (const p of pmts) {
    const hasMultipleAllocations = (() => {
      if (!p.ledgerAllocations) return false;
      try {
        const allocs = JSON.parse(p.ledgerAllocations);
        return Array.isArray(allocs) && allocs.length > 0;
      } catch { return false; }
    })();

    // For multi-ledger payments, journal entries handle the cash/bank ledger amounts.
    // Only use the direct payment record for:
    //   1. Single-ledger fallback (old records without allocations)
    //   2. Party ledger (always uses full amount regardless)
    if (!hasMultipleAllocations) {
      // Single ledger: match by ledgerId (cash/bank side, CR for payment)
      if (Number(p.ledgerId) === Number(id)) {
        allTransactions.push({
          id: p.id,
          date: p.date,
          type: "payment",
          description: p.narration || '',
          ref: p.voucherNumber,
          dr: 0,
          cr: Number(p.amount),
        });
      }
    }

    // Party ledger: always show full amount (DR the party — reducing liability)
    if (matchingPartyId && Number(p.partyId) === Number(matchingPartyId)) {
      allTransactions.push({
        id: p.id,
        date: p.date,
        type: "payment",
        description: p.narration || '',
        ref: p.voucherNumber,
        dr: Number(p.amount),
        cr: 0,
      });
    }
  }

  // ── 3. Receipt vouchers ──────────────────────────────────────────────────────
  for (const r of rcpts) {
    const hasMultipleAllocations = (() => {
      if (!r.ledgerAllocations) return false;
      try {
        const allocs = JSON.parse(r.ledgerAllocations);
        return Array.isArray(allocs) && allocs.length > 0;
      } catch { return false; }
    })();

    // For multi-ledger receipts, journal entries handle the cash/bank ledger amounts.
    // Only use the direct receipt record for:
    //   1. Single-ledger fallback (old records without allocations)
    //   2. Party ledger (always uses full amount)
    if (!hasMultipleAllocations) {
      // Single ledger: match by ledgerId (cash/bank side, DR for receipt)
      if (Number(r.ledgerId) === Number(id)) {
        allTransactions.push({
          id: r.id,
          date: r.date,
          type: "receipt",
          description: r.narration || '',
          ref: r.voucherNumber,
          dr: Number(r.amount),
          cr: 0,
        });
      }
    }

    // Party ledger: always show full amount (CR the party — reducing receivable)
    if (matchingPartyId && Number(r.partyId) === Number(matchingPartyId)) {
      allTransactions.push({
        id: r.id,
        date: r.date,
        type: "receipt",
        description: r.narration || '',
        ref: r.voucherNumber,
        dr: 0,
        cr: Number(r.amount),
      });
    }
  }

  // ── 4. Sale invoices ───────────────────────────────────────────────────────
  const saleConds: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
  if (to) saleConds.push(lte(saleInvoicesTable.date, to));

  const saleInvs = await db.select({
    id: saleInvoicesTable.id,
    date: saleInvoicesTable.date,
    invoiceNumber: saleInvoicesTable.invoiceNumber,
    partyId: saleInvoicesTable.partyId,
    partyName: saleInvoicesTable.partyName,
    notes: saleInvoicesTable.notes,
    otherCharges: saleInvoicesTable.otherCharges,
    grandTotal: saleInvoicesTable.grandTotal,
    totalCgst: saleInvoicesTable.totalCgst,
    totalSgst: saleInvoicesTable.totalSgst,
    totalIgst: saleInvoicesTable.totalIgst,
    isKaccha: saleInvoicesTable.isKaccha,
  }).from(saleInvoicesTable).where(and(...saleConds));

  for (const inv of saleInvs) {
    const taxAmt = Number(inv.totalCgst || 0) + Number(inv.totalSgst || 0) + Number(inv.totalIgst || 0);
    const taxableAmt = Math.max(0, Number(inv.grandTotal) - taxAmt);

    // 1. If party ledger matches (Customer receivable)
    if (matchingPartyId && Number(inv.partyId) === Number(matchingPartyId)) {
      allTransactions.push({
        id: inv.id,
        date: inv.date,
        type: "sale_invoice",
        description: inv.notes || '',
        ref: inv.invoiceNumber,
        dr: Number(inv.grandTotal),
        cr: 0,
      });
    }

    // 2. Sales Account ledger (Sales Income)
    if (isSalesLedger) {
      allTransactions.push({
        id: inv.id,
        date: inv.date,
        type: "sale_invoice",
        description: inv.notes || '',
        ref: inv.invoiceNumber,
        dr: 0,
        cr: taxableAmt,
      });
    }

    // 3. Parse other charges for ledger matching
    const chargesStr = inv.otherCharges;
    if (chargesStr) {
      try {
        const charges = JSON.parse(chargesStr as string || "[]");
        for (const charge of charges) {
          if (Number(charge.ledgerId) === Number(id) && Number(charge.amount) > 0) {
            allTransactions.push({
              id: inv.id,
              date: inv.date,
              type: "sale_invoice",
              description: inv.notes || '',
              ref: inv.invoiceNumber,
              dr: 0,
              cr: Number(charge.amount),
            });
          }
        }
      } catch {}
    }
  }

  // ── 5. Purchase invoices ───────────────────────────────────────────────────
  const purchConds: any[] = [eq(purchaseInvoicesTable.isDeleted, "false")];
  if (to) purchConds.push(lte(purchaseInvoicesTable.date, to));

  const purchInvs = await db.select({
    id: purchaseInvoicesTable.id,
    date: purchaseInvoicesTable.date,
    invoiceNumber: purchaseInvoicesTable.invoiceNumber,
    partyId: purchaseInvoicesTable.partyId,
    partyName: purchaseInvoicesTable.partyName,
    notes: purchaseInvoicesTable.notes,
    otherCharges: purchaseInvoicesTable.otherCharges,
    grandTotal: purchaseInvoicesTable.grandTotal,
    totalCgst: purchaseInvoicesTable.totalCgst,
    totalSgst: purchaseInvoicesTable.totalSgst,
    totalIgst: purchaseInvoicesTable.totalIgst,
    isKaccha: purchaseInvoicesTable.isKaccha,
  }).from(purchaseInvoicesTable).where(and(...purchConds));

  for (const inv of purchInvs) {
    const taxAmt = Number(inv.totalCgst || 0) + Number(inv.totalSgst || 0) + Number(inv.totalIgst || 0);
    const taxableAmt = Math.max(0, Number(inv.grandTotal) - taxAmt);

    // 1. If party ledger matches (Supplier payable)
    if (matchingPartyId && Number(inv.partyId) === Number(matchingPartyId)) {
      allTransactions.push({
        id: inv.id,
        date: inv.date,
        type: "purchase_invoice",
        description: inv.notes || '',
        ref: inv.invoiceNumber,
        dr: 0,
        cr: Number(inv.grandTotal),
      });
    }

    // 2. Purchase Account ledger (Purchase Expense)
    if (isPurchaseLedger) {
      allTransactions.push({
        id: inv.id,
        date: inv.date,
        type: "purchase_invoice",
        description: inv.notes || '',
        ref: inv.invoiceNumber,
        dr: taxableAmt,
        cr: 0,
      });
    }

    // 3. Parse other charges for ledger matching
    const chargesStr = inv.otherCharges;
    if (chargesStr) {
      try {
        const charges = JSON.parse(chargesStr as string || "[]");
        for (const charge of charges) {
          if (Number(charge.ledgerId) === Number(id) && Number(charge.amount) > 0) {
            allTransactions.push({
              id: inv.id,
              date: inv.date,
              type: "purchase_invoice",
              description: inv.notes || '',
              ref: inv.invoiceNumber,
              dr: Number(charge.amount),
              cr: 0,
            });
          }
        }
      } catch {}
    }
  }

  // ── 6. Credit Notes ───────────────────────────────────────────────────────
  const cnConds: any[] = [eq(creditNotesTable.isDeleted, "false")];
  if (to) cnConds.push(lte(creditNotesTable.date, to));

  const cNotes = await db.select().from(creditNotesTable).where(and(...cnConds));
  for (const cn of cNotes) {
    const amt = Number(cn.amount) || 0;
    if (amt > 0) {
      if (matchingPartyId && Number(cn.partyId) === Number(matchingPartyId)) {
        allTransactions.push({
          id: cn.id,
          date: cn.date,
          type: "credit_note",
          description: cn.reason || '',
          ref: cn.noteNumber,
          dr: 0,
          cr: amt,
        });
      }
      if (isSalesLedger) {
        allTransactions.push({
          id: cn.id,
          date: cn.date,
          type: "credit_note",
          description: cn.reason || '',
          ref: cn.noteNumber,
          dr: amt,
          cr: 0,
        });
      }
    }
  }

  // ── 7. Debit Notes ────────────────────────────────────────────────────────
  const dnConds: any[] = [eq(debitNotesTable.isDeleted, "false")];
  if (to) dnConds.push(lte(debitNotesTable.date, to));

  const dNotes = await db.select().from(debitNotesTable).where(and(...dnConds));
  for (const dn of dNotes) {
    const amt = Number(dn.amount) || 0;
    if (amt > 0) {
      if (matchingPartyId && Number(dn.partyId) === Number(matchingPartyId)) {
        allTransactions.push({
          id: dn.id,
          date: dn.date,
          type: "debit_note",
          description: dn.reason || '',
          ref: dn.noteNumber,
          dr: amt,
          cr: 0,
        });
      }
      if (isPurchaseLedger) {
        allTransactions.push({
          id: dn.id,
          date: dn.date,
          type: "debit_note",
          description: dn.reason || '',
          ref: dn.noteNumber,
          dr: 0,
          cr: amt,
        });
      }
    }
  }

  // ── 8. GST ledger entries ─────────────────────────────────────────────────
  const gstField: "totalCgst" | "totalSgst" | "totalIgst" | null =
    (lNameLower.includes("cgst")) ? "totalCgst" :
    (lNameLower.includes("sgst")) ? "totalSgst" :
    (lNameLower.includes("igst")) ? "totalIgst" : null;

  if (gstField) {
    for (const inv of saleInvs) {
      const amt = Number(inv[gstField]);
      if (amt > 0) {
        allTransactions.push({
          date: inv.date,
          type: "sale_invoice",
          description: inv.notes || '',
          ref: inv.invoiceNumber,
          dr: 0,
          cr: amt,
        });
      }
    }
    for (const inv of purchInvs) {
      const amt = Number(inv[gstField]);
      if (amt > 0) {
        allTransactions.push({
          date: inv.date,
          type: "purchase_invoice",
          description: inv.notes || '',
          ref: inv.invoiceNumber,
          dr: amt,
          cr: 0,
        });
      }
    }
  }

  // ── 9. Cash / Bank inline invoice payments ────────────────────────────────
  const thisMapsHere = (mode: string) => modeToLedgerId(mode, allLedgers, cashId) === Number(id);

  const salePmtJoinConds: any[] = [
    eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id),
    eq(saleInvoicesTable.isDeleted, "false"),
    ne(saleInvoicePaymentsTable.mode, "receipt_voucher"),
  ];
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
    allTransactions.push({
      date: p.date,
      type: "sale_invoice",
      description: '',
      ref: p.invoiceNumber,
      dr: Number(p.amount),
      cr: 0,
    });
  }

  const purchPmtJoinConds: any[] = [
    eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id),
    eq(purchaseInvoicesTable.isDeleted, "false"),
    ne(purchaseInvoicePaymentsTable.mode, "payment_voucher"),
  ];
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
    allTransactions.push({
      date: p.date,
      type: "purchase_invoice",
      description: '',
      ref: p.invoiceNumber,
      dr: 0,
      cr: Number(p.amount),
    });
  }

  // ── 10. Sort chronologically (ASC) to compute running balances correctly ──
  const sorted = allTransactions.sort((a, b) => a.date.localeCompare(b.date));

  // Split into prior period vs current date-filtered period
  const priorTxs = from ? sorted.filter(t => t.date < from) : [];
  const periodTxs = from ? sorted.filter(t => t.date >= from) : sorted;

  const dbInitialNet = Number(ledger.openingBalance) * (ledger.nature === "cr" ? -1 : 1);
  const priorNet = priorTxs.reduce((sum: number, t: any) => sum + (t.dr - t.cr), 0);
  const periodOpeningNet = dbInitialNet + priorNet;

  let runningNet = periodOpeningNet;
  const rows = periodTxs.map(t => {
    runningNet += t.dr - t.cr;
    return { ...t, balance: Math.abs(runningNet), balanceNature: runningNet >= 0 ? "dr" : "cr" };
  });

  const allRows: any[] = [];
  // Include Opening Balance row in the statement table if opening balance exists or if there are no other transactions
  if (Math.abs(periodOpeningNet) > 0 || periodTxs.length === 0) {
    const opDate = from || (ledger.createdAt ? String(ledger.createdAt).split('T')[0] : '2026-04-01');
    const isDr = periodOpeningNet >= 0;
    allRows.push({
      id: null,
      date: opDate,
      type: "opening_balance",
      description: "Opening Balance",
      ref: "-",
      dr: isDr ? Math.abs(periodOpeningNet) : 0,
      cr: !isDr ? Math.abs(periodOpeningNet) : 0,
      balance: Math.abs(periodOpeningNet),
      balanceNature: isDr ? "dr" : "cr",
    });
  }
  allRows.push(...rows);

  // Reverse so the latest entry appears first (most recent at top)
  const rowsDesc = [...allRows].reverse();

  const totalDr = rows.reduce((s: number, t: any) => s + t.dr, 0);
  const totalCr = rows.reduce((s: number, t: any) => s + t.cr, 0);

  res.json({
    ledgerId: Number(ledger.id),
    ledgerName: ledger.name,
    group: ledger.group,
    nature: ledger.nature,
    isSystem: ledger.isSystem,
    openingBalance: Math.abs(periodOpeningNet),
    openingNature: periodOpeningNet >= 0 ? "dr" : "cr",
    transactions: rowsDesc,
    totalDr,
    totalCr,
    closingBalance: runningNet,
  });
});

export default router;
