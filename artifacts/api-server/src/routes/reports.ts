import { Router } from "express";
import { db } from "@workspace/db";
import {
  saleInvoicesTable, saleInvoiceItemsTable, purchaseInvoicesTable, purchaseInvoiceItemsTable,
  saleInvoicePaymentsTable, purchaseInvoicePaymentsTable,
  paymentsTable, receiptsTable, journalEntriesTable, journalLinesTable,
  ledgersTable, stockItemsTable, stockBatchesTable, ordersTable,
  creditNotesTable, debitNotesTable, creditNoteItemsTable, debitNoteItemsTable
, partiesTable } from "@workspace/db/schema";
import { eq, and, gte, lte, sql, inArray, isNull, ilike } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

import { companySettingsTable } from "@workspace/db/schema";
async function getEnableDualLedger() {
  const [settings] = await db.select().from(companySettingsTable).limit(1);
  return settings?.enableDualLedger ?? false;
}


async function getLedgersWithParties() {
  const [dbLedgers, parties] = await Promise.all([
    db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false")),
    db.select().from(partiesTable).where(eq(partiesTable.isDeleted, "false")),
  ]);
  const partyLedgers = parties.map(p => ({
    id: 1000000 + p.id,
    name: p.name,
    group: p.accountGroup || (p.type === 'customer' ? 'Sundry Debtors' : 'Sundry Creditors'),
    nature: p.balanceType || (p.type === 'customer' ? 'dr' : 'cr'),
    openingBalance: p.openingBalance,
  }));
  return [...dbLedgers, ...partyLedgers].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
}


router.get("/reports/day-book", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  const { date } = req.query;
  const d = (date as string) || new Date().toISOString().slice(0, 10);

  const sales = await db.select({
    id: saleInvoicesTable.id,
    type: sql<string>`'Sale Invoice'`,
    number: saleInvoicesTable.invoiceNumber,
    party: saleInvoicesTable.partyName,
    dr: saleInvoicesTable.grandTotal,
    cr: sql<string>`'0'`,
    date: saleInvoicesTable.date,
  }).from(saleInvoicesTable).where(and(eq(saleInvoicesTable.date, d), and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))));

  const purchases = await db.select({
    id: purchaseInvoicesTable.id,
    type: sql<string>`'Purchase Invoice'`,
    number: purchaseInvoicesTable.invoiceNumber,
    party: purchaseInvoicesTable.partyName,
    dr: sql<string>`'0'`,
    cr: purchaseInvoicesTable.grandTotal,
    date: purchaseInvoicesTable.date,
  }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.date, d), and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))));

  const pmts = await db.select({
    id: paymentsTable.id,
    type: sql<string>`'Payment'`,
    number: paymentsTable.voucherNumber,
    party: paymentsTable.partyName,
    dr: paymentsTable.amount,
    cr: sql<string>`'0'`,
    date: paymentsTable.date,
  }).from(paymentsTable).where(and(eq(paymentsTable.date, d), and(eq(paymentsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(paymentsTable.isKaccha, false))));

  const rcts = await db.select({
    id: receiptsTable.id,
    type: sql<string>`'Receipt'`,
    number: receiptsTable.voucherNumber,
    party: receiptsTable.partyName,
    dr: sql<string>`'0'`,
    cr: receiptsTable.amount,
    date: receiptsTable.date,
  }).from(receiptsTable).where(and(eq(receiptsTable.date, d), and(eq(receiptsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(receiptsTable.isKaccha, false))));

  const all = [...sales, ...purchases, ...pmts, ...rcts].map(r => ({
    ...r,
    dr: Number(r.dr),
    cr: Number(r.cr),
  }));

  res.json({ date: d, entries: all, totalDr: all.reduce((s, r) => s + r.dr, 0), totalCr: all.reduce((s, r) => s + r.cr, 0) });
});

router.get("/reports/trial-balance", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  // Fetch all transaction data in parallel
  const [
    ledgers,
    journalLines,
    saleInvoices,
    purchaseInvoices,
    receipts,
    payments,
    creditNotes,
    debitNotes,
    saleInvoicePayments,
    purchaseInvoicePayments,
  ] = await Promise.all([
    getLedgersWithParties(),
    db
      .select({ line: journalLinesTable })
      .from(journalLinesTable)
      .innerJoin(
        journalEntriesTable,
        and(
          eq(journalLinesTable.entryId, journalEntriesTable.id),
          and(eq(journalEntriesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(journalEntriesTable.isKaccha, false)),
        ),
      ),
    db.select().from(saleInvoicesTable).where(and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))),
    db.select().from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))),
    db.select().from(receiptsTable).where(and(eq(receiptsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(receiptsTable.isKaccha, false))),
    db.select().from(paymentsTable).where(and(eq(paymentsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(paymentsTable.isKaccha, false))),
    db.select().from(creditNotesTable).where(and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false))),
    db.select().from(debitNotesTable).where(and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false))),
    // Inline payments recorded directly on sale invoices
    db.select({
      mode: saleInvoicePaymentsTable.mode,
      amount: saleInvoicePaymentsTable.amount,
      partyId: saleInvoicesTable.partyId,
    }).from(saleInvoicePaymentsTable)
      .innerJoin(saleInvoicesTable, and(
        eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id),
        and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false)),
      )),
    // Inline payments recorded directly on purchase invoices
    db.select({
      mode: purchaseInvoicePaymentsTable.mode,
      amount: purchaseInvoicePaymentsTable.amount,
      partyId: purchaseInvoicesTable.partyId,
    }).from(purchaseInvoicePaymentsTable)
      .innerJoin(purchaseInvoicesTable, and(
        eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id),
        and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false)),
      )),
  ]);

  // Find canonical ledger IDs by name (fall back to known defaults)
  const byName = (name: string) => ledgers.find(l => l.name === name)?.id;
  const LEDGER = {
    cash:        byName("Cash")                ?? 1,
    ar:          byName("Accounts Receivable") ?? 3,
    ap:          byName("Accounts Payable")    ?? 5,
    sales:       byName("Sales")               ?? 9,
    purchase:    byName("Purchase")            ?? 10,
    cgstPayable: byName("CGST") ?? byName("CGST Payable") ?? 20,
    sgstPayable: byName("SGST") ?? byName("SGST Payable") ?? 21,
    igstPayable: byName("IGST") ?? byName("IGST Payable") ?? 22,
  };

  // Build ledger balance map: ledgerId -> { dr, cr }
  const bal: Record<number, { dr: number; cr: number }> = {};
  const add = (ledgerId: number, type: "dr" | "cr", amount: number) => {
    if (amount === 0) return;
    if (!bal[ledgerId]) bal[ledgerId] = { dr: 0, cr: 0 };
    bal[ledgerId][type] += amount;
  };

  // 1. Manual journal entries (only from non-deleted entries)
  for (const { line } of journalLines) {
    add(line.ledgerId, line.type as "dr" | "cr", Number(line.amount));
  }

  // 2. Sale invoices — double-entry synthesis
  //    Dr: Accounts Receivable (credit sale) or Cash (cash sale: no party)
  //    Cr: Sales (taxable) + CGST Payable + SGST Payable + IGST Payable
  for (const inv of saleInvoices) {
    const grandTotal = Number(inv.grandTotal);
    const cgst = Number(inv.totalCgst);
    const sgst = Number(inv.totalSgst);
    const igst = Number(inv.totalIgst);
    const taxable = grandTotal - cgst - sgst - igst;
    add(inv.partyId ? 1000000 + inv.partyId : LEDGER.cash, "dr", grandTotal);
    add(LEDGER.sales, "cr", taxable);
    add(LEDGER.cgstPayable, "cr", cgst);
    add(LEDGER.sgstPayable, "cr", sgst);
    add(LEDGER.igstPayable, "cr", igst);
  }

  // 3. Purchase invoices — double-entry synthesis
  //    Dr: Purchase (taxable) + CGST Payable (ITC) + SGST Payable (ITC) + IGST Payable (ITC)
  //    Cr: Accounts Payable (credit purchase) or Cash (cash purchase)
  for (const inv of purchaseInvoices) {
    const grandTotal = Number(inv.grandTotal);
    const cgst = Number(inv.totalCgst);
    const sgst = Number(inv.totalSgst);
    const igst = Number(inv.totalIgst);
    const taxable = grandTotal - cgst - sgst - igst;
    add(LEDGER.purchase, "dr", taxable);
    add(LEDGER.cgstPayable, "dr", cgst);
    add(LEDGER.sgstPayable, "dr", sgst);
    add(LEDGER.igstPayable, "dr", igst);
    add(inv.partyId ? 1000000 + inv.partyId : LEDGER.cash, "cr", grandTotal);
  }

  // 4. Receipts (money received from customers)
  //    Dr: ledger_id (cash/bank account where money came in)
  //    Cr: Accounts Receivable (reduces what the customer owes)
  for (const r of receipts) {
    const amount = Number(r.amount);
    add(r.ledgerId, "dr", amount);
    add((typeof r !== "undefined" && r.partyId) ? 1000000 + r.partyId : ((typeof cn !== "undefined" && cn.partyId) ? 1000000 + cn.partyId : ((typeof p !== "undefined" && p.partyId) ? 1000000 + p.partyId : LEDGER.ar)), "cr", amount);
  }

  // 5. Payments (money paid to suppliers)
  //    Dr: Accounts Payable (reduces what we owe the supplier)
  //    Cr: ledger_id (cash/bank account from which money went out)
  for (const p of payments) {
    const amount = Number(p.amount);
    add((typeof p !== "undefined" && p.partyId) ? 1000000 + p.partyId : ((typeof dn !== "undefined" && dn.partyId) ? 1000000 + dn.partyId : LEDGER.ap), "dr", amount);
    add(p.ledgerId, "cr", amount);
  }

  // 6. Credit notes (sale returns) — reversal of a sale
  //    Dr: Sales (reduces revenue)
  //    Cr: Accounts Receivable (customer owes less / gets refund)
  for (const cn of creditNotes) {
    const amount = Number(cn.amount);
    add(LEDGER.sales, "dr", amount);
    add((typeof r !== "undefined" && r.partyId) ? 1000000 + r.partyId : ((typeof cn !== "undefined" && cn.partyId) ? 1000000 + cn.partyId : ((typeof p !== "undefined" && p.partyId) ? 1000000 + p.partyId : LEDGER.ar)), "cr", amount);
  }

  // 7. Debit notes (purchase returns) — reversal of a purchase
  //    Dr: Accounts Payable (we owe supplier less)
  //    Cr: Purchase (reduces purchase expense)
  for (const dn of debitNotes) {
    const amount = Number(dn.amount);
    add((typeof p !== "undefined" && p.partyId) ? 1000000 + p.partyId : ((typeof dn !== "undefined" && dn.partyId) ? 1000000 + dn.partyId : LEDGER.ap), "dr", amount);
    add(LEDGER.purchase, "cr", amount);
  }

  // Helper: map a payment mode string to a ledger ID.
  // "cash" → Cash; named bank accounts → find by ledger name; fallback → Cash.
  const modeToLedgerId = (mode: string): number => {
    if (!mode) return LEDGER.cash;
    if (mode.startsWith("bank_")) return Number(mode.replace("bank_", ""));
    if (mode.startsWith("ledger_")) return Number(mode.replace("ledger_", ""));
    if (!isNaN(Number(mode))) return Number(mode);
    if (mode.toLowerCase() === "cash" || mode.toLowerCase() === "upi" || mode.toLowerCase() === "cheque") {
      return LEDGER.cash;
    }
    return byName(mode) ?? LEDGER.cash;
  };

  // 8. Inline sale-invoice payments (recorded on invoice form / Record Payment button)
  //    These reduce what the customer owes — same effect as a standalone Receipt voucher.
  //    Dr: Cash / Bank (mode-mapped)
  //    Cr: Accounts Receivable
  for (const p of saleInvoicePayments) {
    const amount = Number(p.amount);
    add(modeToLedgerId(p.mode), "dr", amount);
    add((typeof r !== "undefined" && r.partyId) ? 1000000 + r.partyId : ((typeof cn !== "undefined" && cn.partyId) ? 1000000 + cn.partyId : ((typeof p !== "undefined" && p.partyId) ? 1000000 + p.partyId : LEDGER.ar)), "cr", amount);
  }

  // 9. Inline purchase-invoice payments (recorded on purchase invoice form)
  //    These reduce what we owe the supplier — same effect as a standalone Payment voucher.
  //    Dr: Accounts Payable
  //    Cr: Cash / Bank (mode-mapped)
  for (const p of purchaseInvoicePayments) {
    const amount = Number(p.amount);
    add((typeof p !== "undefined" && p.partyId) ? 1000000 + p.partyId : ((typeof dn !== "undefined" && dn.partyId) ? 1000000 + dn.partyId : LEDGER.ap), "dr", amount);
    add(modeToLedgerId(p.mode), "cr", amount);
  }

  // Build result rows — opening balance added to its natural side
  const rows = ledgers.map(l => {
    const b = bal[l.id] || { dr: 0, cr: 0 };
    const opening = Number(l.openingBalance);
    const netDr = b.dr + (l.nature === "dr" ? opening : 0);
    const netCr = b.cr + (l.nature === "cr" ? opening : 0);
    return {
      id: l.id,
      name: l.name,
      group: l.group,
      nature: l.nature,
      openingBalance: opening,
      debit: netDr,
      credit: netCr,
      closing: netDr - netCr,
    };
  });

  res.json({
    rows,
    totalDebit: rows.reduce((s, r) => s + r.debit, 0),
    totalCredit: rows.reduce((s, r) => s + r.credit, 0),
  });
});

router.get("/reports/profit-loss", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  const { from, to } = req.query;

  const saleCond: any[] = [and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))];
  if (from) saleCond.push(gte(saleInvoicesTable.date, from as string));
  if (to) saleCond.push(lte(saleInvoicesTable.date, to as string));

  const purCond: any[] = [and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))];
  if (from) purCond.push(gte(purchaseInvoicesTable.date, from as string));
  if (to) purCond.push(lte(purchaseInvoicesTable.date, to as string));

  const cnCond: any[] = [and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false))];
  if (from) cnCond.push(gte(creditNotesTable.date, from as string));
  if (to) cnCond.push(lte(creditNotesTable.date, to as string));

  const dnCond: any[] = [and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false))];
  if (from) dnCond.push(gte(debitNotesTable.date, from as string));
  if (to) dnCond.push(lte(debitNotesTable.date, to as string));

  const jeCond: any[] = [and(eq(journalEntriesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(journalEntriesTable.isKaccha, false))];
  if (from) jeCond.push(gte(journalEntriesTable.date, from as string));
  if (to) jeCond.push(lte(journalEntriesTable.date, to as string));

  const [saleRow, purRow, cnRow, dnRow, journalLines, ledgers] = await Promise.all([
    db.select({
      taxable: sql<string>`COALESCE(SUM(grand_total - total_cgst - total_sgst - total_igst), 0)`,
    }).from(saleInvoicesTable).where(and(...saleCond)),
    db.select({
      taxable: sql<string>`COALESCE(SUM(grand_total - total_cgst - total_sgst - total_igst), 0)`,
    }).from(purchaseInvoicesTable).where(and(...purCond)),
    db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(creditNotesTable).where(and(...cnCond)),
    db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(debitNotesTable).where(and(...dnCond)),
    db.select({ line: journalLinesTable })
      .from(journalLinesTable)
      .innerJoin(journalEntriesTable, eq(journalLinesTable.entryId, journalEntriesTable.id))
      .where(and(...jeCond)),
    getLedgersWithParties(),
  ]);

  const salesRevenue = Number(saleRow[0]?.taxable ?? 0);
  const salesReturns = Number(cnRow[0]?.total ?? 0);
  const netSales = salesRevenue - salesReturns;

  const purchaseCost = Number(purRow[0]?.taxable ?? 0);
  const purchaseReturns = Number(dnRow[0]?.total ?? 0);
  const netPurchases = purchaseCost - purchaseReturns;

  const grossProfit = netSales - netPurchases;

  // Aggregate income and expense movements from manual journal entries
  const ledgerMap = new Map(ledgers.map(l => [l.id, l]));
  const otherIncome: Record<string, number> = {};
  const otherExpenses: Record<string, number> = {};

  for (const { line } of journalLines) {
    const ledger = ledgerMap.get(line.ledgerId);
    if (!ledger) continue;
    const amount = Number(line.amount);
    if (ledger.group === "income") {
      const net = line.type === "cr" ? amount : -amount;
      otherIncome[ledger.name] = (otherIncome[ledger.name] || 0) + net;
    }
    if (ledger.group === "expense") {
      const net = line.type === "dr" ? amount : -amount;
      otherExpenses[ledger.name] = (otherExpenses[ledger.name] || 0) + net;
    }
  }

  const totalOtherIncome = Object.values(otherIncome).reduce((s, v) => s + v, 0);
  const totalOtherExpenses = Object.values(otherExpenses).reduce((s, v) => s + v, 0);
  const netProfit = grossProfit + totalOtherIncome - totalOtherExpenses;

  res.json({
    period: { from: from || null, to: to || null },
    income: {
      sales: salesRevenue,
      salesReturns,
      netSales,
      otherIncome,
      totalOtherIncome,
      total: netSales + totalOtherIncome,
    },
    expenses: {
      purchases: purchaseCost,
      purchaseReturns,
      netPurchases,
      otherExpenses,
      totalOtherExpenses,
      total: netPurchases + totalOtherExpenses,
    },
    grossProfit,
    netProfit,
  });
});

router.get("/reports/balance-sheet", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  // Fetch all transaction data in parallel (same sources as trial balance)
  const [
    ledgers,
    journalLines,
    saleInvoices,
    purchaseInvoices,
    receipts,
    payments,
    creditNotes,
    debitNotes,
    saleInvoicePayments,
    purchaseInvoicePayments,
  ] = await Promise.all([
    getLedgersWithParties(),
    db
      .select({ line: journalLinesTable })
      .from(journalLinesTable)
      .innerJoin(
        journalEntriesTable,
        and(
          eq(journalLinesTable.entryId, journalEntriesTable.id),
          and(eq(journalEntriesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(journalEntriesTable.isKaccha, false)),
        ),
      ),
    db.select().from(saleInvoicesTable).where(and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))),
    db.select().from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))),
    db.select().from(receiptsTable).where(and(eq(receiptsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(receiptsTable.isKaccha, false))),
    db.select().from(paymentsTable).where(and(eq(paymentsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(paymentsTable.isKaccha, false))),
    db.select().from(creditNotesTable).where(and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false))),
    db.select().from(debitNotesTable).where(and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false))),
    db.select({
      mode: saleInvoicePaymentsTable.mode,
      amount: saleInvoicePaymentsTable.amount,
      partyId: saleInvoicesTable.partyId,
    }).from(saleInvoicePaymentsTable)
      .innerJoin(saleInvoicesTable, and(
        eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id),
        and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false)),
      )),
    db.select({
      mode: purchaseInvoicePaymentsTable.mode,
      amount: purchaseInvoicePaymentsTable.amount,
      partyId: purchaseInvoicesTable.partyId,
    }).from(purchaseInvoicePaymentsTable)
      .innerJoin(purchaseInvoicesTable, and(
        eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id),
        and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false)),
      )),
  ]);

  // Canonical ledger IDs by name
  const byName = (name: string) => ledgers.find(l => l.name === name)?.id;
  const LEDGER = {
    cash:        byName("Cash")                ?? 1,
    ar:          byName("Accounts Receivable") ?? 3,
    ap:          byName("Accounts Payable")    ?? 5,
    sales:       byName("Sales")               ?? 9,
    purchase:    byName("Purchase")            ?? 10,
    cgstPayable: byName("CGST") ?? byName("CGST Payable") ?? 20,
    sgstPayable: byName("SGST") ?? byName("SGST Payable") ?? 21,
    igstPayable: byName("IGST") ?? byName("IGST Payable") ?? 22,
  };

  // Build Dr/Cr balance map from all transaction sources
  const bal: Record<number, { dr: number; cr: number }> = {};
  const add = (ledgerId: number, type: "dr" | "cr", amount: number) => {
    if (amount === 0) return;
    if (!bal[ledgerId]) bal[ledgerId] = { dr: 0, cr: 0 };
    bal[ledgerId][type] += amount;
  };

  // 1. Manual journal entries
  for (const { line } of journalLines) {
    add(line.ledgerId, line.type as "dr" | "cr", Number(line.amount));
  }

  // 2. Sale invoices: Dr AR/Cash, Cr Sales + CGST Payable + SGST Payable + IGST Payable
  for (const inv of saleInvoices) {
    const grandTotal = Number(inv.grandTotal);
    const cgst = Number(inv.totalCgst);
    const sgst = Number(inv.totalSgst);
    const igst = Number(inv.totalIgst);
    const taxable = grandTotal - cgst - sgst - igst;
    add(inv.partyId ? 1000000 + inv.partyId : LEDGER.cash, "dr", grandTotal);
    add(LEDGER.sales, "cr", taxable);
    add(LEDGER.cgstPayable, "cr", cgst);
    add(LEDGER.sgstPayable, "cr", sgst);
    add(LEDGER.igstPayable, "cr", igst);
  }

  // 3. Purchase invoices: Dr Purchase + CGST/SGST/IGST Payable (ITC), Cr AP/Cash
  for (const inv of purchaseInvoices) {
    const grandTotal = Number(inv.grandTotal);
    const cgst = Number(inv.totalCgst);
    const sgst = Number(inv.totalSgst);
    const igst = Number(inv.totalIgst);
    const taxable = grandTotal - cgst - sgst - igst;
    add(LEDGER.purchase, "dr", taxable);
    add(LEDGER.cgstPayable, "dr", cgst);
    add(LEDGER.sgstPayable, "dr", sgst);
    add(LEDGER.igstPayable, "dr", igst);
    add(inv.partyId ? 1000000 + inv.partyId : LEDGER.cash, "cr", grandTotal);
  }

  // 4. Receipts: Dr ledger (cash/bank), Cr AR
  for (const r of receipts) {
    add(r.ledgerId, "dr", Number(r.amount));
    add(r.partyId ? 1000000 + r.partyId : LEDGER.ar, "cr", Number(r.amount));
  }

  // 5. Payments: Dr AP, Cr ledger (cash/bank)
  for (const p of payments) {
    add(p.partyId ? 1000000 + p.partyId : LEDGER.ap, "dr", Number(p.amount));
    add(p.ledgerId, "cr", Number(p.amount));
  }

  // 6. Credit notes (sale returns): Dr Sales, Cr AR
  for (const cn of creditNotes) {
    add(LEDGER.sales, "dr", Number(cn.amount));
    add(cn.partyId ? 1000000 + cn.partyId : LEDGER.ar, "cr", Number(cn.amount));
  }

  // 7. Debit notes (purchase returns): Dr AP, Cr Purchase
  for (const dn of debitNotes) {
    add(dn.partyId ? 1000000 + dn.partyId : LEDGER.ap, "dr", Number(dn.amount));
    add(LEDGER.purchase, "cr", Number(dn.amount));
  }

  // 8. Inline sale-invoice payments: Dr Cash/Bank, Cr AR
  const modeToLedgerId = (mode: string): number => {
    if (!mode) return LEDGER.cash;
    if (mode.startsWith("bank_")) return Number(mode.replace("bank_", ""));
    if (mode.startsWith("ledger_")) return Number(mode.replace("ledger_", ""));
    if (!isNaN(Number(mode))) return Number(mode);
    if (mode.toLowerCase() === "cash" || mode.toLowerCase() === "upi" || mode.toLowerCase() === "cheque") {
      return LEDGER.cash;
    }
    return byName(mode) ?? LEDGER.cash;
  };
  for (const p of saleInvoicePayments) {
    add(modeToLedgerId(p.mode), "dr", Number(p.amount));
    add(p.partyId ? 1000000 + p.partyId : LEDGER.ar, "cr", Number(p.amount));
  }

  // 9. Inline purchase-invoice payments: Dr AP, Cr Cash/Bank
  for (const p of purchaseInvoicePayments) {
    add(p.partyId ? 1000000 + p.partyId : LEDGER.ap, "dr", Number(p.amount));
    add(modeToLedgerId(p.mode), "cr", Number(p.amount));
  }

  // Compute net balance for a ledger (positive = normal balance for its nature)
  //   Dr-nature: opening + Dr movements - Cr movements
  //   Cr-nature: opening + Cr movements - Dr movements
  const netBal = (l: typeof ledgers[0]) => {
    const b = bal[l.id] || { dr: 0, cr: 0 };
    const opening = Number(l.openingBalance);
    return l.nature === "dr"
      ? opening + b.dr - b.cr
      : opening + b.cr - b.dr;
  };

  // Net Profit = net income ledger balances minus net expense ledger balances
  // Income ledgers (Cr nature): positive balance = revenue earned
  // Expense ledgers (Dr nature): positive balance = cost incurred
  const incomeNet = ledgers
    .filter(l => l.group === "income")
    .reduce((s, l) => s + netBal(l), 0);
  const expenseNet = ledgers
    .filter(l => l.group === "expense")
    .reduce((s, l) => s + netBal(l), 0);
  const netProfit = incomeNet - expenseNet;

  // Assets: Dr-nature ledgers that are NOT expense accounts
  // Includes "assets", "Sundry Debtors", "Bank Accounts", and any other Dr-nature groups
  const assetItems = ledgers
    .filter(l => l.nature === "dr" && l.group !== "expense")
    .map(l => ({ name: l.name, group: l.group, amount: netBal(l) }));

  // Liabilities: Cr-nature ledgers that are NOT capital or income
  const liabilityItems = ledgers
    .filter(l => l.nature === "cr" && l.group !== "capital" && l.group !== "income")
    .map(l => ({ name: l.name, group: l.group, amount: netBal(l) }));

  // Capital accounts
  const capitalItems = ledgers
    .filter(l => l.group === "capital")
    .map(l => ({ name: l.name, amount: netBal(l) }));

  const totalAssets = assetItems.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = liabilityItems.reduce((s, l) => s + l.amount, 0);
  const totalCapital = capitalItems.reduce((s, c) => s + c.amount, 0);

  res.json({
    assets: { items: assetItems, total: totalAssets },
    liabilities: { items: liabilityItems, total: totalLiabilities },
    capital: { items: capitalItems, total: totalCapital },
    netProfit,
    totalLiabilitiesAndCapital: totalLiabilities + totalCapital + netProfit,
  });
});

router.get("/reports/sale-register", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  const { from, to } = req.query;
  const conditions: any[] = [and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))];
  if (from) conditions.push(gte(saleInvoicesTable.date, from as string));
  if (to) conditions.push(lte(saleInvoicesTable.date, to as string));

  const invoices = await db.select().from(saleInvoicesTable).where(and(...conditions)).orderBy(sql`date ASC`);

  res.json({
    invoices: invoices.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      date: i.date,
      partyName: i.partyName,
      partyGstin: i.partyGstin,
      totalTaxable: Number(i.totalTaxable),
      totalCgst: Number(i.totalCgst),
      totalSgst: Number(i.totalSgst),
      totalIgst: Number(i.totalIgst),
      grandTotal: Number(i.grandTotal),
    })),
    totals: {
      taxable: invoices.reduce((s, i) => s + Number(i.totalTaxable), 0),
      cgst: invoices.reduce((s, i) => s + Number(i.totalCgst), 0),
      sgst: invoices.reduce((s, i) => s + Number(i.totalSgst), 0),
      igst: invoices.reduce((s, i) => s + Number(i.totalIgst), 0),
      grandTotal: invoices.reduce((s, i) => s + Number(i.grandTotal), 0),
    },
  });
});

router.get("/reports/purchase-register", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  const { from, to } = req.query;
  const conditions: any[] = [and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))];
  if (from) conditions.push(gte(purchaseInvoicesTable.date, from as string));
  if (to) conditions.push(lte(purchaseInvoicesTable.date, to as string));

  const invoices = await db.select().from(purchaseInvoicesTable).where(and(...conditions)).orderBy(sql`date ASC`);

  res.json({
    invoices: invoices.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      supplierInvoiceNumber: i.supplierInvoiceNumber,
      date: i.date,
      partyName: i.partyName,
      totalTaxable: Number(i.totalTaxable),
      totalCgst: Number(i.totalCgst),
      totalSgst: Number(i.totalSgst),
      totalIgst: Number(i.totalIgst),
      grandTotal: Number(i.grandTotal),
    })),
    totals: {
      taxable: invoices.reduce((s, i) => s + Number(i.totalTaxable), 0),
      cgst: invoices.reduce((s, i) => s + Number(i.totalCgst), 0),
      sgst: invoices.reduce((s, i) => s + Number(i.totalSgst), 0),
      igst: invoices.reduce((s, i) => s + Number(i.totalIgst), 0),
      grandTotal: invoices.reduce((s, i) => s + Number(i.grandTotal), 0),
    },
  });
});

router.get("/reports/cash-book", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  const { from, to } = req.query;
  const cashLedgers = await db.select({ id: ledgersTable.id }).from(ledgersTable).where(ilike(ledgersTable.group, "%cash%"));
  const cashLedgerIds = cashLedgers.map(l => l.id);

  const pmtCond: any[] = [and(eq(paymentsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(paymentsTable.isKaccha, false)), inArray(paymentsTable.ledgerId, cashLedgerIds.length ? cashLedgerIds : [0])];
  const rctCond: any[] = [and(eq(receiptsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(receiptsTable.isKaccha, false)), inArray(receiptsTable.ledgerId, cashLedgerIds.length ? cashLedgerIds : [0])];
  const saleInvPmtCond: any[] = [eq(saleInvoicePaymentsTable.mode, "cash"), and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))];
  const purInvPmtCond: any[] = [eq(purchaseInvoicePaymentsTable.mode, "cash"), and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))];
  const jeCond: any[] = [and(eq(journalEntriesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(journalEntriesTable.isKaccha, false)), inArray(journalLinesTable.ledgerId, cashLedgerIds.length ? cashLedgerIds : [0])];
  
  if (from) {
    pmtCond.push(gte(paymentsTable.date, from as string));
    rctCond.push(gte(receiptsTable.date, from as string));
    saleInvPmtCond.push(gte(saleInvoicesTable.date, from as string));
    purInvPmtCond.push(gte(purchaseInvoicesTable.date, from as string));
    jeCond.push(gte(journalEntriesTable.date, from as string));
  }
  if (to) {
    pmtCond.push(lte(paymentsTable.date, to as string));
    rctCond.push(lte(receiptsTable.date, to as string));
    saleInvPmtCond.push(lte(saleInvoicesTable.date, to as string));
    purInvPmtCond.push(lte(purchaseInvoicesTable.date, to as string));
    jeCond.push(lte(journalEntriesTable.date, to as string));
  }

  const [pmts, rcts, saleInvPmts, purInvPmts, journalLines] = await Promise.all([
    db.select().from(paymentsTable).where(and(...pmtCond)),
    db.select().from(receiptsTable).where(and(...rctCond)),
    db.select({
      id: saleInvoicesTable.id,
      date: saleInvoicesTable.date,
      ref: saleInvoicesTable.invoiceNumber,
      party: saleInvoicesTable.partyName,
      amount: saleInvoicePaymentsTable.amount,
    }).from(saleInvoicePaymentsTable)
      .innerJoin(saleInvoicesTable, eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id))
      .where(and(...saleInvPmtCond)),
    db.select({
      id: purchaseInvoicesTable.id,
      date: purchaseInvoicesTable.date,
      ref: purchaseInvoicesTable.invoiceNumber,
      party: purchaseInvoicesTable.partyName,
      amount: purchaseInvoicePaymentsTable.amount,
    }).from(purchaseInvoicePaymentsTable)
      .innerJoin(purchaseInvoicesTable, eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id))
      .where(and(...purInvPmtCond)),
    db.select({
      id: journalEntriesTable.id,
      date: journalEntriesTable.date,
      ref: journalEntriesTable.voucherNumber,
      description: journalEntriesTable.narration,
      amount: journalLinesTable.amount,
      type: journalLinesTable.type,
    }).from(journalLinesTable)
      .innerJoin(journalEntriesTable, eq(journalLinesTable.entryId, journalEntriesTable.id))
      .where(and(...jeCond)),
  ]);

  const out = pmts.map(p => ({ id: p.id, date: p.date, type: "payment" as const, ref: p.voucherNumber, party: p.partyName || "", description: p.narration || `Payment to ${p.partyName || ""}`, cashIn: 0, cashOut: Number(p.amount) }));
  const inc = rcts.map(r => ({ id: r.id, date: r.date, type: "receipt" as const, ref: r.voucherNumber, party: r.partyName || "", description: r.narration || `Receipt from ${r.partyName || ""}`, cashIn: Number(r.amount), cashOut: 0 }));
  const saleInvInc = saleInvPmts.map(p => ({ id: p.id, date: p.date, type: "sale-invoice" as const, ref: p.ref, party: p.party || "", description: `Cash collection — ${p.ref}`, cashIn: Number(p.amount), cashOut: 0 }));
  const purInvOut = purInvPmts.map(p => ({ id: p.id, date: p.date, type: "purchase-invoice" as const, ref: p.ref, party: p.party || "", description: `Cash payment — ${p.ref}`, cashIn: 0, cashOut: Number(p.amount) }));
  const jeEntries = journalLines.map(j => ({ id: j.id, date: j.date, type: "journal" as const, ref: j.ref, party: "", description: j.description || `Journal Entry — ${j.ref}`, cashIn: j.type === "dr" ? Number(j.amount) : 0, cashOut: j.type === "cr" ? Number(j.amount) : 0 }));

  const sorted = [...out, ...inc, ...saleInvInc, ...purInvOut, ...jeEntries].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  let balance = 0;
  const entries = sorted.map(e => {
    balance += e.cashIn - e.cashOut;
    return { ...e, balance };
  });

  const totalIn = inc.reduce((s, r) => s + r.cashIn, 0) + saleInvInc.reduce((s, r) => s + r.cashIn, 0) + jeEntries.reduce((s, j) => s + j.cashIn, 0);
  const totalOut2 = out.reduce((s, r) => s + r.cashOut, 0) + purInvOut.reduce((s, r) => s + r.cashOut, 0) + jeEntries.reduce((s, j) => s + j.cashOut, 0);
  res.json({ entries, totalOut: totalOut2, totalIn });
});

router.get("/reports/bank-book", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  const { from, to } = req.query;
  
  const bankLedgers = await db.select({ id: ledgersTable.id }).from(ledgersTable).where(ilike(ledgersTable.group, "%bank%"));
  const bankLedgerIds = bankLedgers.map(l => l.id);
  
  if (bankLedgerIds.length === 0) {
    return res.json({ entries: [], totalOut: 0, totalIn: 0 });
  }

  const pmtCond: any[] = [and(eq(paymentsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(paymentsTable.isKaccha, false)), inArray(paymentsTable.ledgerId, bankLedgerIds)];
  const rctCond: any[] = [and(eq(receiptsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(receiptsTable.isKaccha, false)), inArray(receiptsTable.ledgerId, bankLedgerIds)];
  const saleInvPmtCond: any[] = [sql`${saleInvoicePaymentsTable.mode} != 'cash'`, and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))];
  const purInvPmtCond: any[] = [sql`${purchaseInvoicePaymentsTable.mode} != 'cash'`, and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))];
  const jeCond: any[] = [and(eq(journalEntriesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(journalEntriesTable.isKaccha, false)), inArray(journalLinesTable.ledgerId, bankLedgerIds)];
  
  if (from) {
    pmtCond.push(gte(paymentsTable.date, from as string));
    rctCond.push(gte(receiptsTable.date, from as string));
    saleInvPmtCond.push(gte(saleInvoicesTable.date, from as string));
    purInvPmtCond.push(gte(purchaseInvoicesTable.date, from as string));
    jeCond.push(gte(journalEntriesTable.date, from as string));
  }
  if (to) {
    pmtCond.push(lte(paymentsTable.date, to as string));
    rctCond.push(lte(receiptsTable.date, to as string));
    saleInvPmtCond.push(lte(saleInvoicesTable.date, to as string));
    purInvPmtCond.push(lte(purchaseInvoicesTable.date, to as string));
    jeCond.push(lte(journalEntriesTable.date, to as string));
  }

  const [pmts, rcts, saleInvPmts, purInvPmts, journalLines] = await Promise.all([
    db.select().from(paymentsTable).where(and(...pmtCond)),
    db.select().from(receiptsTable).where(and(...rctCond)),
    db.select({
      id: saleInvoicesTable.id,
      date: saleInvoicesTable.date,
      ref: saleInvoicesTable.invoiceNumber,
      party: saleInvoicesTable.partyName,
      amount: saleInvoicePaymentsTable.amount,
      mode: saleInvoicePaymentsTable.mode,
    }).from(saleInvoicePaymentsTable)
      .innerJoin(saleInvoicesTable, eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id))
      .where(and(...saleInvPmtCond)),
    db.select({
      id: purchaseInvoicesTable.id,
      date: purchaseInvoicesTable.date,
      ref: purchaseInvoicesTable.invoiceNumber,
      party: purchaseInvoicesTable.partyName,
      amount: purchaseInvoicePaymentsTable.amount,
      mode: purchaseInvoicePaymentsTable.mode,
    }).from(purchaseInvoicePaymentsTable)
      .innerJoin(purchaseInvoicesTable, eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id))
      .where(and(...purInvPmtCond)),
    db.select({
      id: journalEntriesTable.id,
      date: journalEntriesTable.date,
      ref: journalEntriesTable.voucherNumber,
      description: journalEntriesTable.narration,
      amount: journalLinesTable.amount,
      type: journalLinesTable.type,
    }).from(journalLinesTable)
      .innerJoin(journalEntriesTable, eq(journalLinesTable.entryId, journalEntriesTable.id))
      .where(and(...jeCond)),
  ]);

  const out = pmts.map(p => ({ id: p.id, date: p.date, type: "payment" as const, ref: p.voucherNumber, party: p.partyName || "", description: p.narration || `Payment to ${p.partyName || ""} (${p.paymentMode})`, cashIn: 0, cashOut: Number(p.amount) }));
  const inc = rcts.map(r => ({ id: r.id, date: r.date, type: "receipt" as const, ref: r.voucherNumber, party: r.partyName || "", description: r.narration || `Receipt from ${r.partyName || ""} (${r.paymentMode})`, cashIn: Number(r.amount), cashOut: 0 }));
  const saleInvInc = saleInvPmts.map(p => ({ id: p.id, date: p.date, type: "sale-invoice" as const, ref: p.ref, party: p.party || "", description: `Bank collection (${p.mode}) — ${p.ref}`, cashIn: Number(p.amount), cashOut: 0 }));
  const purInvOut = purInvPmts.map(p => ({ id: p.id, date: p.date, type: "purchase-invoice" as const, ref: p.ref, party: p.party || "", description: `Bank payment (${p.mode}) — ${p.ref}`, cashIn: 0, cashOut: Number(p.amount) }));
  const jeEntries = journalLines.map(j => ({ id: j.id, date: j.date, type: "journal" as const, ref: j.ref, party: "", description: j.description || `Journal Entry — ${j.ref}`, cashIn: j.type === "dr" ? Number(j.amount) : 0, cashOut: j.type === "cr" ? Number(j.amount) : 0 }));

  const sorted = [...out, ...inc, ...saleInvInc, ...purInvOut, ...jeEntries].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  let balance = 0;
  const entries = sorted.map(e => {
    balance += e.cashIn - e.cashOut;
    return { ...e, balance };
  });

  const totalIn = inc.reduce((s, r) => s + r.cashIn, 0) + saleInvInc.reduce((s, r) => s + r.cashIn, 0) + jeEntries.reduce((s, j) => s + j.cashIn, 0);
  const totalOut2 = out.reduce((s, r) => s + r.cashOut, 0) + purInvOut.reduce((s, r) => s + r.cashOut, 0) + jeEntries.reduce((s, j) => s + j.cashOut, 0);
  res.json({ entries, totalOut: totalOut2, totalIn });
});

router.get("/reports/all-transactions", authMiddleware, async (req, res) => {
  const { from, to } = req.query;

  const addCond = (conditions: any[], dateField: any) => {
    if (from) conditions.push(gte(dateField, from as string));
    if (to) conditions.push(lte(dateField, to as string));
    return conditions;
  };

  const saleCond = addCond([and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))], saleInvoicesTable.date);
  const purCond = addCond([and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))], purchaseInvoicesTable.date);
  const pmtCond = addCond([and(eq(paymentsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(paymentsTable.isKaccha, false))], paymentsTable.date);
  const rctCond = addCond([and(eq(receiptsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(receiptsTable.isKaccha, false))], receiptsTable.date);
  const jeCond = addCond([and(eq(journalEntriesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(journalEntriesTable.isKaccha, false))], journalEntriesTable.date);
  const orderCond = addCond([and(eq(ordersTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(ordersTable.isKaccha, false))], ordersTable.date);
  const cnCond = addCond([and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false))], creditNotesTable.date);
  const dnCond = addCond([and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false))], debitNotesTable.date);

  const [sales, purchases, payments, receipts, journals, orders, creditNotes, debitNotes] = await Promise.all([
    db.select().from(saleInvoicesTable).where(and(...saleCond)),
    db.select().from(purchaseInvoicesTable).where(and(...purCond)),
    db.select().from(paymentsTable).where(and(...pmtCond)),
    db.select().from(receiptsTable).where(and(...rctCond)),
    db.select().from(journalEntriesTable).where(and(...jeCond)),
    db.select().from(ordersTable).where(and(...orderCond)),
    db.select().from(creditNotesTable).where(and(...cnCond)),
    db.select().from(debitNotesTable).where(and(...dnCond)),
  ]);

  const all = [
    ...sales.map(i => ({ id: i.id, date: i.date, type: "Sale Invoice", number: i.invoiceNumber, party: i.partyName, amount: Number(i.grandTotal), debit: Number(i.grandTotal), credit: 0 })),
    ...purchases.map(i => ({ id: i.id, date: i.date, type: "Purchase Invoice", number: i.invoiceNumber, party: i.partyName, amount: Number(i.grandTotal), debit: 0, credit: Number(i.grandTotal) })),
    ...payments.map(p => ({ id: p.id, date: p.date, type: "Payment", number: p.voucherNumber, party: p.partyName || "", amount: Number(p.amount), debit: Number(p.amount), credit: 0 })),
    ...receipts.map(r => ({ id: r.id, date: r.date, type: "Receipt", number: r.voucherNumber, party: r.partyName || "", amount: Number(r.amount), debit: 0, credit: Number(r.amount) })),
    ...journals.map(j => ({ id: j.id, date: j.date, type: "Journal", number: j.voucherNumber, party: j.narration || "", amount: Number(j.totalDebit), debit: Number(j.totalDebit), credit: Number(j.totalCredit) })),
    ...orders.map(o => ({ id: o.id, date: o.date, type: "Order", number: o.orderNumber, party: o.partyName, amount: Number(o.grandTotal), debit: 0, credit: 0 })),
    ...creditNotes.map(c => ({ id: c.id, date: c.date, type: "Credit Note", number: c.noteNumber, party: c.partyName, amount: Number(c.amount), debit: 0, credit: Number(c.amount) })),
    ...debitNotes.map(d => ({ id: d.id, date: d.date, type: "Debit Note", number: d.noteNumber, party: d.partyName, amount: Number(d.amount), debit: Number(d.amount), credit: 0 })),
  ].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  res.json({ transactions: all, count: all.length });
});

router.get("/reports/party-statement", authMiddleware, async (req, res) => {
  const enableDualLedger = await getEnableDualLedger();
  const { partyId, from, to } = req.query;
  if (!partyId) { return res.json({ transactions: [], openingBalance: 0, closingBalance: 0 }); }

  let targetIdStr = String(partyId);
  let isParty = true;
  let targetId = 0;
  if (targetIdStr.startsWith("ledger_")) {
    isParty = false;
    targetId = Number(targetIdStr.replace("ledger_", ""));
  } else if (targetIdStr.startsWith("party_")) {
    isParty = true;
    targetId = Number(targetIdStr.replace("party_", ""));
  } else {
    isParty = true;
    targetId = Number(targetIdStr);
  }
  const targetInternalId = isParty ? 1000000 + targetId : targetId;

  const [
    ledgers,
    journalLines,
    saleInvoices,
    purchaseInvoices,
    receipts,
    payments,
    creditNotes,
    debitNotes,
    saleInvoicePayments,
    purchaseInvoicePayments,
  ] = await Promise.all([
    getLedgersWithParties(),
    db
      .select({ line: journalLinesTable, date: journalEntriesTable.date, ref: journalEntriesTable.voucherNumber, narration: journalEntriesTable.narration })
      .from(journalLinesTable)
      .innerJoin(journalEntriesTable, and(eq(journalLinesTable.entryId, journalEntriesTable.id), and(eq(journalEntriesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(journalEntriesTable.isKaccha, false)))),
    db.select().from(saleInvoicesTable).where(and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false))),
    db.select().from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false))),
    db.select().from(receiptsTable).where(and(eq(receiptsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(receiptsTable.isKaccha, false))),
    db.select().from(paymentsTable).where(and(eq(paymentsTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(paymentsTable.isKaccha, false))),
    db.select().from(creditNotesTable).where(and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false))),
    db.select().from(debitNotesTable).where(and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false))),
    db.select({
      mode: saleInvoicePaymentsTable.mode,
      amount: saleInvoicePaymentsTable.amount,
      partyId: saleInvoicesTable.partyId,
      date: saleInvoicesTable.date,
      ref: saleInvoicesTable.invoiceNumber,
    }).from(saleInvoicePaymentsTable)
      .innerJoin(saleInvoicesTable, and(eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id), and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false)))),
    db.select({
      mode: purchaseInvoicePaymentsTable.mode,
      amount: purchaseInvoicePaymentsTable.amount,
      partyId: purchaseInvoicesTable.partyId,
      date: purchaseInvoicesTable.date,
      ref: purchaseInvoicesTable.invoiceNumber,
    }).from(purchaseInvoicePaymentsTable)
      .innerJoin(purchaseInvoicesTable, and(eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id), and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false)))),
  ]);

  const byName = (name: string) => ledgers.find(l => l.name === name)?.id;
  const LEDGER = {
    cash:        byName("Cash")                ?? 1,
    ar:          byName("Accounts Receivable") ?? 3,
    ap:          byName("Accounts Payable")    ?? 5,
    sales:       byName("Sales")               ?? 9,
    purchase:    byName("Purchase")            ?? 10,
    cgstPayable: byName("CGST") ?? byName("CGST Payable") ?? 20,
    sgstPayable: byName("SGST") ?? byName("SGST Payable") ?? 21,
    igstPayable: byName("IGST") ?? byName("IGST Payable") ?? 22,
  };

  const all: any[] = [];
  const addTx = (ledgerId: number, type: "dr" | "cr", amount: number, tx: any) => {
    if (amount === 0) return;
    if (ledgerId === targetInternalId) {
      all.push({ ...tx, debit: type === "dr" ? amount : 0, credit: type === "cr" ? amount : 0 });
    }
  };

  for (const row of journalLines) {
    addTx(row.line.ledgerId, row.line.type as "dr" | "cr", Number(row.line.amount), { id: row.line.entryId, date: row.date, type: "Journal", number: row.ref, narration: row.narration });
  }

  for (const inv of saleInvoices) {
    const grandTotal = Number(inv.grandTotal);
    const cgst = Number(inv.totalCgst);
    const sgst = Number(inv.totalSgst);
    const igst = Number(inv.totalIgst);
    const taxable = grandTotal - cgst - sgst - igst;
    const baseTx = { id: inv.id, date: inv.date, type: "Sale Invoice", number: inv.invoiceNumber, narration: `Sale to ${inv.partyName}` };
    addTx(inv.partyId ? 1000000 + inv.partyId : LEDGER.cash, "dr", grandTotal, baseTx);
    addTx(LEDGER.sales, "cr", taxable, baseTx);
    addTx(LEDGER.cgstPayable, "cr", cgst, baseTx);
    addTx(LEDGER.sgstPayable, "cr", sgst, baseTx);
    addTx(LEDGER.igstPayable, "cr", igst, baseTx);
  }

  for (const inv of purchaseInvoices) {
    const grandTotal = Number(inv.grandTotal);
    const cgst = Number(inv.totalCgst);
    const sgst = Number(inv.totalSgst);
    const igst = Number(inv.totalIgst);
    const taxable = grandTotal - cgst - sgst - igst;
    const baseTx = { id: inv.id, date: inv.date, type: "Purchase Invoice", number: inv.invoiceNumber, narration: `Purchase from ${inv.partyName}` };
    addTx(LEDGER.purchase, "dr", taxable, baseTx);
    addTx(LEDGER.cgstPayable, "dr", cgst, baseTx);
    addTx(LEDGER.sgstPayable, "dr", sgst, baseTx);
    addTx(LEDGER.igstPayable, "dr", igst, baseTx);
    addTx(inv.partyId ? 1000000 + inv.partyId : LEDGER.cash, "cr", grandTotal, baseTx);
  }

  for (const r of receipts) {
    const baseTx = { id: r.id, date: r.date, type: "Receipt", number: r.voucherNumber, narration: r.narration || `Receipt from ${r.partyName || "Cash/Bank"}` };
    addTx(r.ledgerId, "dr", Number(r.amount), baseTx);
    addTx(r.partyId ? 1000000 + r.partyId : LEDGER.ar, "cr", Number(r.amount), baseTx);
  }

  for (const p of payments) {
    const baseTx = { id: p.id, date: p.date, type: "Payment", number: p.voucherNumber, narration: p.narration || `Payment to ${p.partyName || "Cash/Bank"}` };
    addTx(p.partyId ? 1000000 + p.partyId : LEDGER.ap, "dr", Number(p.amount), baseTx);
    addTx(p.ledgerId, "cr", Number(p.amount), baseTx);
  }

  for (const cn of creditNotes) {
    const baseTx = { id: cn.id, date: cn.date, type: "Credit Note", number: cn.noteNumber, narration: cn.narration || `Sale Return` };
    addTx(LEDGER.sales, "dr", Number(cn.amount), baseTx);
    addTx(cn.partyId ? 1000000 + cn.partyId : LEDGER.ar, "cr", Number(cn.amount), baseTx);
  }

  for (const dn of debitNotes) {
    const baseTx = { id: dn.id, date: dn.date, type: "Debit Note", number: dn.noteNumber, narration: dn.narration || `Purchase Return` };
    addTx(dn.partyId ? 1000000 + dn.partyId : LEDGER.ap, "dr", Number(dn.amount), baseTx);
    addTx(LEDGER.purchase, "cr", Number(dn.amount), baseTx);
  }

    const modeToLedgerId = (mode: string): number => {
      if (!mode) return LEDGER.cash;
      if (mode.startsWith("bank_")) return Number(mode.replace("bank_", ""));
      if (mode.startsWith("ledger_")) return Number(mode.replace("ledger_", ""));
      if (!isNaN(Number(mode))) return Number(mode);
      if (mode.toLowerCase() === "cash" || mode.toLowerCase() === "upi" || mode.toLowerCase() === "cheque") return LEDGER.cash;
      return byName(mode) ?? LEDGER.cash;
    };

  for (const p of saleInvoicePayments) {
    const baseTx = { id: null, date: p.date, type: "Receipt", number: p.ref, narration: `Collection for ${p.ref}` };
    addTx(modeToLedgerId(p.mode), "dr", Number(p.amount), baseTx);
    addTx(p.partyId ? 1000000 + p.partyId : LEDGER.ar, "cr", Number(p.amount), baseTx);
  }

  for (const p of purchaseInvoicePayments) {
    const baseTx = { id: null, date: p.date, type: "Payment", number: p.ref, narration: `Payment for ${p.ref}` };
    addTx(p.partyId ? 1000000 + p.partyId : LEDGER.ap, "dr", Number(p.amount), baseTx);
    addTx(modeToLedgerId(p.mode), "cr", Number(p.amount), baseTx);
  }

  const targetLedger = ledgers.find(l => l.id === targetInternalId);
  const isCrNature = targetLedger?.nature === "cr";
  let runningBalance = targetLedger ? Number(targetLedger.openingBalance) : 0;
  if (isCrNature) { runningBalance = -runningBalance; } // Keep balance conceptually dr-positive during math

  all.sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  const transactions: any[] = [];
  for (const t of all) {
    if (from && t.date < from) {
      runningBalance += t.debit - t.credit;
    } else if (to && t.date > to) {
      // ignore
    } else {
      runningBalance += t.debit - t.credit;
      transactions.push({ ...t, balance: runningBalance });
    }
  }

  res.json({ transactions, closingBalance: runningBalance });
});

router.get("/reports/stock-summary", authMiddleware, async (req, res) => {
    const enableDualLedger = await getEnableDualLedger();
  const { from, to } = req.query;

  const items = await db.select().from(stockItemsTable).where(eq(stockItemsTable.isDeleted, "false")).orderBy(stockItemsTable.name);

  // Purchases within period
  const purchasedItems = await db.select({
    stockItemId: purchaseInvoiceItemsTable.stockItemId,
    qty: sql<string>`SUM(${purchaseInvoiceItemsTable.quantity})`,
    value: sql<string>`SUM(${purchaseInvoiceItemsTable.taxableAmount})`,
  }).from(purchaseInvoiceItemsTable)
    .innerJoin(purchaseInvoicesTable, eq(purchaseInvoiceItemsTable.invoiceId, purchaseInvoicesTable.id))
    .where(and(
      and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false)),
      ...(from ? [gte(purchaseInvoicesTable.date, from as string)] : []),
      ...(to ? [lte(purchaseInvoicesTable.date, to as string)] : []),
    ))
    .groupBy(purchaseInvoiceItemsTable.stockItemId);

  // Sales within period
  const soldItems = await db.select({
    stockItemId: saleInvoiceItemsTable.stockItemId,
    qty: sql<string>`SUM(${saleInvoiceItemsTable.quantity})`,
    value: sql<string>`SUM(${saleInvoiceItemsTable.taxableAmount})`,
  }).from(saleInvoiceItemsTable)
    .innerJoin(saleInvoicesTable, eq(saleInvoiceItemsTable.invoiceId, saleInvoicesTable.id))
    .where(and(
      and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false)),
      ...(from ? [gte(saleInvoicesTable.date, from as string)] : []),
      ...(to ? [lte(saleInvoicesTable.date, to as string)] : []),
    ))
    .groupBy(saleInvoiceItemsTable.stockItemId);

  // Credit notes = sale returns → stock comes back in
  const creditNoteItems = await db.select({
    stockItemId: creditNoteItemsTable.stockItemId,
    qty: sql<string>`SUM(${creditNoteItemsTable.quantity})`,
    value: sql<string>`SUM(${creditNoteItemsTable.taxableAmount})`,
  }).from(creditNoteItemsTable)
    .innerJoin(creditNotesTable, eq(creditNoteItemsTable.noteId, creditNotesTable.id))
    .where(and(
      and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false)),
      ...(from ? [gte(creditNotesTable.date, from as string)] : []),
      ...(to ? [lte(creditNotesTable.date, to as string)] : []),
    ))
    .groupBy(creditNoteItemsTable.stockItemId);

  // Debit notes = purchase returns → stock goes out
  const debitNoteItems = await db.select({
    stockItemId: debitNoteItemsTable.stockItemId,
    qty: sql<string>`SUM(${debitNoteItemsTable.quantity})`,
    value: sql<string>`SUM(${debitNoteItemsTable.taxableAmount})`,
  }).from(debitNoteItemsTable)
    .innerJoin(debitNotesTable, eq(debitNoteItemsTable.noteId, debitNotesTable.id))
    .where(and(
      and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false)),
      ...(from ? [gte(debitNotesTable.date, from as string)] : []),
      ...(to ? [lte(debitNotesTable.date, to as string)] : []),
    ))
    .groupBy(debitNoteItemsTable.stockItemId);

  const toMap = <T extends { stockItemId: number | null; qty: string; value: string }>(rows: T[]) => {
    const map: Record<number, { qty: number; value: number }> = {};
    for (const r of rows) {
      if (r.stockItemId) map[r.stockItemId] = { qty: Number(r.qty), value: Number(r.value) };
    }
    return map;
  };

  const purchasedMap = toMap(purchasedItems);
  const soldMap      = toMap(soldItems);
  const creditMap    = toMap(creditNoteItems);
  const debitMap     = toMap(debitNoteItems);

  const summary = items.map(item => {
    const purchased    = purchasedMap[item.id] || { qty: 0, value: 0 };
    const sold         = soldMap[item.id]      || { qty: 0, value: 0 };
    const saleReturn   = creditMap[item.id]    || { qty: 0, value: 0 }; // credit note = sale return → stock in
    const purchReturn  = debitMap[item.id]     || { qty: 0, value: 0 }; // debit note  = purchase return → stock out

    // physicalStock is the CURRENT (closing) stock, kept accurate by all transactions
    const closingQty = Number(item.physicalStock) || 0;

    // Derive opening by reversing the period's net movement
    // openingQty = closingQty - purchased - saleReturn + sold + purchReturn
    const openingQty = closingQty - purchased.qty - saleReturn.qty + sold.qty + purchReturn.qty;

    const rate = Number(item.purchaseRate) || 0;
    const openingValue = openingQty * rate;

    // Closing value = openingValue + net purchases (using actual invoice taxable amounts)
    const closingValue = openingValue
      + purchased.value + saleReturn.value
      - sold.value      - purchReturn.value;

    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      hsnCode: item.hsnCode,
      purchaseRate: rate,
      saleRate: Number(item.saleRate) || 0,
      openingQty,
      openingValue,
      purchasedQty:      purchased.qty,
      purchasedValue:    purchased.value,
      soldQty:           sold.qty,
      soldValue:         sold.value,
      saleReturnQty:     saleReturn.qty,
      saleReturnValue:   saleReturn.value,
      purchaseReturnQty: purchReturn.qty,
      purchaseReturnValue: purchReturn.value,
      closingQty,
      closingValue,
    };
  });

  res.json({ summary, period: { from: from || null, to: to || null } });
});

// ── Batch-wise Stock Summary ──────────────────────────────────────────────────
router.get("/reports/stock-summary-batch", authMiddleware, async (req, res) => {
    const enableDualLedger = await getEnableDualLedger();
  const { from, to } = req.query;

  const [items, batches] = await Promise.all([
    db.select().from(stockItemsTable)
      .where(eq(stockItemsTable.isDeleted, "false"))
      .orderBy(stockItemsTable.name),
    db.select().from(stockBatchesTable)
      .orderBy(stockBatchesTable.name),
  ]);

  // Group batches by item
  const batchesByItem: Record<number, typeof batches> = {};
  for (const b of batches) {
    if (b.stockItemId) {
      if (!batchesByItem[b.stockItemId]) batchesByItem[b.stockItemId] = [];
      batchesByItem[b.stockItemId].push(b);
    }
  }

  const dateFilter = (dateCol: any) => and(
    ...(from ? [gte(dateCol, from as string)] : []),
    ...(to   ? [lte(dateCol, to   as string)] : []),
  );

  // Purchases (inward) grouped by itemId + batchId
  const [purchRows, saleRows, creditRows, debitRows] = await Promise.all([
    db.select({
      stockItemId: purchaseInvoiceItemsTable.stockItemId,
      batchId:     purchaseInvoiceItemsTable.batchId,
      qty:   sql<string>`SUM(${purchaseInvoiceItemsTable.quantity})`,
      value: sql<string>`SUM(${purchaseInvoiceItemsTable.taxableAmount})`,
    }).from(purchaseInvoiceItemsTable)
      .innerJoin(purchaseInvoicesTable, eq(purchaseInvoiceItemsTable.invoiceId, purchaseInvoicesTable.id))
      .where(and(and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false)), dateFilter(purchaseInvoicesTable.date)))
      .groupBy(purchaseInvoiceItemsTable.stockItemId, purchaseInvoiceItemsTable.batchId),

    // Sales (outward) grouped by itemId + batchId
    db.select({
      stockItemId: saleInvoiceItemsTable.stockItemId,
      batchId:     saleInvoiceItemsTable.batchId,
      qty:   sql<string>`SUM(${saleInvoiceItemsTable.quantity})`,
      value: sql<string>`SUM(${saleInvoiceItemsTable.taxableAmount})`,
    }).from(saleInvoiceItemsTable)
      .innerJoin(saleInvoicesTable, eq(saleInvoiceItemsTable.invoiceId, saleInvoicesTable.id))
      .where(and(and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false)), dateFilter(saleInvoicesTable.date)))
      .groupBy(saleInvoiceItemsTable.stockItemId, saleInvoiceItemsTable.batchId),

    // Credit notes (sale returns → inward, no batch) grouped by itemId
    db.select({
      stockItemId: creditNoteItemsTable.stockItemId,
      qty:   sql<string>`SUM(${creditNoteItemsTable.quantity})`,
      value: sql<string>`SUM(${creditNoteItemsTable.taxableAmount})`,
    }).from(creditNoteItemsTable)
      .innerJoin(creditNotesTable, eq(creditNoteItemsTable.noteId, creditNotesTable.id))
      .where(and(and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false)), dateFilter(creditNotesTable.date)))
      .groupBy(creditNoteItemsTable.stockItemId),

    // Debit notes (purchase returns → outward, no batch) grouped by itemId
    db.select({
      stockItemId: debitNoteItemsTable.stockItemId,
      qty:   sql<string>`SUM(${debitNoteItemsTable.quantity})`,
      value: sql<string>`SUM(${debitNoteItemsTable.taxableAmount})`,
    }).from(debitNoteItemsTable)
      .innerJoin(debitNotesTable, eq(debitNoteItemsTable.noteId, debitNotesTable.id))
      .where(and(and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false)), dateFilter(debitNotesTable.date)))
      .groupBy(debitNoteItemsTable.stockItemId),
  ]);

  // Build lookup maps keyed by "itemId-batchId"
  const purchMap: Record<string, { qty: number; value: number }> = {};
  for (const r of purchRows) {
    const k = `${r.stockItemId}-${r.batchId ?? "null"}`;
    purchMap[k] = { qty: Number(r.qty), value: Number(r.value) };
  }
  const saleMap: Record<string, { qty: number; value: number }> = {};
  for (const r of saleRows) {
    const k = `${r.stockItemId}-${r.batchId ?? "null"}`;
    saleMap[k] = { qty: Number(r.qty), value: Number(r.value) };
  }
  const creditMap: Record<number, { qty: number; value: number }> = {};
  for (const r of creditRows) {
    if (r.stockItemId) creditMap[r.stockItemId] = { qty: Number(r.qty), value: Number(r.value) };
  }
  const debitMap: Record<number, { qty: number; value: number }> = {};
  for (const r of debitRows) {
    if (r.stockItemId) debitMap[r.stockItemId] = { qty: Number(r.qty), value: Number(r.value) };
  }

  function buildRow(
    itemId: number,
    batchId: number | null,
    closingQty: number,
    baseRate: number,
    inclCreditDebit: boolean,
  ) {
    const k = `${itemId}-${batchId ?? "null"}`;
    const purch  = purchMap[k]  || { qty: 0, value: 0 };
    const sale   = saleMap[k]   || { qty: 0, value: 0 };
    // Credit/debit notes are item-level (no batch), only added to the null-batch row
    const credit = inclCreditDebit ? (creditMap[itemId] || { qty: 0, value: 0 }) : { qty: 0, value: 0 };
    const debit  = inclCreditDebit ? (debitMap[itemId]  || { qty: 0, value: 0 }) : { qty: 0, value: 0 };

    const inwardQty   = purch.qty  + credit.qty;
    const inwardValue = purch.value + credit.value;
    const outwardQty  = sale.qty   + debit.qty;
    const outwardValue = sale.value + debit.value;

    // Derive opening from closing by reversing period movement
    const openingQty   = closingQty - inwardQty + outwardQty;
    const openingRate  = baseRate;
    const openingValue = openingQty * openingRate;

    const inwardRate  = inwardQty  > 0 ? inwardValue  / inwardQty  : 0;
    const outwardRate = outwardQty > 0 ? outwardValue / outwardQty : 0;

    // Weighted average cost for closing
    const avgDenom    = openingQty + inwardQty;
    const closingRate = avgDenom > 0 ? (openingValue + inwardValue) / avgDenom : baseRate;
    const closingValue = closingQty * closingRate;

    return {
      batchId, batchName: null as string | null, expiryDate: null as string | null,
      openingQty, openingRate, openingValue,
      inwardQty, inwardRate, inwardValue,
      outwardQty, outwardRate, outwardValue,
      closingQty, closingRate, closingValue,
    };
  }

  const result = items.map(item => {
    const itemBatches = batchesByItem[item.id] || [];
    const baseRate    = Number(item.purchaseRate) || 0;
    const rows = [];

    if (itemBatches.length === 0) {
      // No batches — single main stock row
      rows.push({ ...buildRow(item.id, null, Number(item.physicalStock) || 0, baseRate, true), batchName: null });
    } else {
      // Has batches: main (unbatched) row + each batch row
      const mainRow = buildRow(item.id, null, Number(item.physicalStock) || 0, baseRate, true);
      rows.push({ ...mainRow, batchName: null });

      for (const b of itemBatches) {
        const br = buildRow(item.id, b.id, Number(b.physicalStock) || 0, baseRate, false);
        rows.push({ ...br, batchId: b.id, batchName: b.name, expiryDate: b.expiryDate ?? null });
      }
    }

    return {
      itemId:   item.id,
      itemName: item.name,
      unit:     item.unit,
      hsnCode:  item.hsnCode,
      rows,
    };
  });

  res.json({ items: result, period: { from: from || null, to: to || null } });
});

router.get("/reports/delivery-report", authMiddleware, async (req, res) => {
    const enableDualLedger = await getEnableDualLedger();
  const { from, to } = req.query;
  const conditions: any[] = [and(eq(ordersTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(ordersTable.isKaccha, false))];
  if (from) conditions.push(gte(ordersTable.date, from as string));
  if (to) conditions.push(lte(ordersTable.date, to as string));

  const orders = await db.select().from(ordersTable).where(and(...conditions)).orderBy(sql`date DESC`);

  const dispatched = orders.filter(o => o.vehicleNo || o.vehicleName || o.driverName);
  const vehicleMap: Record<string, { count: number; totalAmount: number; orders: any[] }> = {};
  for (const o of dispatched) {
    const key = o.vehicleNo || o.vehicleName || "Unknown";
    if (!vehicleMap[key]) vehicleMap[key] = { count: 0, totalAmount: 0, orders: [] };
    vehicleMap[key].count += 1;
    vehicleMap[key].totalAmount += Number(o.grandTotal);
    vehicleMap[key].orders.push({
      id: o.id,
      orderNumber: o.orderNumber,
      date: o.date,
      deliveryDate: o.deliveryDate,
      partyName: o.partyName,
      driverName: o.driverName,
      vehicleName: o.vehicleName,
      vehicleNo: o.vehicleNo,
      grandTotal: Number(o.grandTotal),
      status: o.status,
    });
  }

  res.json({
    orders: dispatched.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      date: o.date,
      deliveryDate: o.deliveryDate,
      partyName: o.partyName,
      driverName: o.driverName,
      vehicleName: o.vehicleName,
      vehicleNo: o.vehicleNo,
      grandTotal: Number(o.grandTotal),
      status: o.status,
    })),
    vehicleSummary: Object.entries(vehicleMap).map(([vehicle, data]) => ({
      vehicle,
      count: data.count,
      totalAmount: data.totalAmount,
    })),
    totalOrders: dispatched.length,
    totalAmount: dispatched.reduce((s, o) => s + Number(o.grandTotal), 0),
  });
});

router.get("/reports/stock-current", authMiddleware, async (req, res) => {
    const enableDualLedger = await getEnableDualLedger();
  const result = await db.execute(sql`
    SELECT
      si.id,
      si.name,
      si.unit,
      si.hsn_code AS "hsnCode",
      si.physical_stock::numeric AS "unbatchedStock",
      COALESCE(SUM(sb.physical_stock::numeric), 0) AS "batchedStock",
      si.physical_stock::numeric + COALESCE(SUM(sb.physical_stock::numeric), 0) AS "physicalStock",
      si.min_stock_level::numeric AS "minStockLevel",
      si.purchase_rate::numeric AS "purchaseRate",
      si.sale_rate::numeric AS "saleRate"
    FROM stock_items si
    LEFT JOIN stock_batches sb ON sb.stock_item_id = si.id
    WHERE si.is_deleted = 'false'
    GROUP BY si.id, si.name, si.unit, si.hsn_code, si.physical_stock, si.min_stock_level, si.purchase_rate, si.sale_rate
    ORDER BY si.name
  `);
  res.json((result.rows as any[]).map(i => ({
    id: Number(i.id),
    name: i.name,
    unit: i.unit,
    hsnCode: i.hsnCode,
    physicalStock: Number(i.physicalStock),
    unbatchedStock: Number(i.unbatchedStock),
    batchedStock: Number(i.batchedStock),
    minStockLevel: Number(i.minStockLevel),
    purchaseRate: Number(i.purchaseRate),
    saleRate: Number(i.saleRate),
    value: Number(i.physicalStock) * Number(i.purchaseRate),
    isLow: Number(i.physicalStock) <= Number(i.minStockLevel),
  })));
});

router.get("/stock-availability", authMiddleware, async (req, res) => {
    const enableDualLedger = await getEnableDualLedger();
  const result = await db.execute(sql`
    SELECT
      si.id,
      si.name,
      si.unit,
      si.hsn_code AS "hsnCode",
      si.physical_stock::numeric AS "unbatchedStock",
      si.physical_stock::numeric + COALESCE(batch_totals.total, 0) AS "physicalStock",
      si.purchase_rate::numeric AS "purchaseRate",
      si.sale_rate::numeric AS "saleRate",
      si.min_stock_level::numeric AS "minStockLevel",
      COALESCE(reserved.qty, 0)::numeric AS "reservedQty",
      COALESCE(reserved_unbatched.qty, 0)::numeric AS "reservedUnbatched"
    FROM stock_items si
    LEFT JOIN (
      SELECT stock_item_id, SUM(physical_stock::numeric) AS total
      FROM stock_batches
      GROUP BY stock_item_id
    ) AS batch_totals ON batch_totals.stock_item_id = si.id
    LEFT JOIN (
      SELECT oi.stock_item_id, SUM(oi.quantity::numeric) AS qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.converted_invoice_id IS NULL
        AND o.status = 'pending'
        AND o.is_deleted = 'false'
      GROUP BY oi.stock_item_id
    ) AS reserved ON reserved.stock_item_id = si.id
    LEFT JOIN (
      SELECT oi.stock_item_id, SUM(oi.quantity::numeric) AS qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.converted_invoice_id IS NULL
        AND o.status = 'pending'
        AND o.is_deleted = 'false'
        AND oi.batch_id IS NULL
      GROUP BY oi.stock_item_id
    ) AS reserved_unbatched ON reserved_unbatched.stock_item_id = si.id
    WHERE si.is_deleted = 'false'
    ORDER BY si.name
  `);
  res.json(result.rows.map((r: any) => ({
    id: Number(r.id),
    name: r.name,
    unit: r.unit,
    hsnCode: r.hsnCode,
    unbatchedStock: Number(r.unbatchedStock),
    physicalStock: Number(r.physicalStock),
    reservedQty: Number(r.reservedQty),
    availableStock: Number(r.physicalStock) - Number(r.reservedQty),
    unbatchedAvailable: Number(r.unbatchedStock) - Number(r.reservedUnbatched),
    purchaseRate: Number(r.purchaseRate),
    saleRate: Number(r.saleRate),
    minStockLevel: Number(r.minStockLevel),
  })));
});

router.get("/reports/stock-ledger/:id", authMiddleware, async (req, res) => {
    const enableDualLedger = await getEnableDualLedger();
  const itemId = Number(req.params.id);
  const { from, to } = req.query;

  const item = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, itemId)).limit(1);
  if (!item.length) { res.status(404).json({ error: "Item not found" }); return; }

  const addDateCond = (conds: any[], dateField: any) => {
    if (from) conds.push(gte(dateField, from as string));
    if (to) conds.push(lte(dateField, to as string));
    return conds;
  };

  const [purchItems, saleItems, cnItems, dnItems] = await Promise.all([
    db.select({
      date: purchaseInvoicesTable.date,
      number: purchaseInvoicesTable.invoiceNumber,
      sourceId: purchaseInvoicesTable.id,
      party: purchaseInvoicesTable.partyName,
      qty: purchaseInvoiceItemsTable.quantity,
    }).from(purchaseInvoiceItemsTable)
      .innerJoin(purchaseInvoicesTable, eq(purchaseInvoiceItemsTable.invoiceId, purchaseInvoicesTable.id))
      .where(and(
        eq(purchaseInvoiceItemsTable.stockItemId, itemId),
        and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false)),
        ...addDateCond([], purchaseInvoicesTable.date),
      )),
    db.select({
      date: saleInvoicesTable.date,
      number: saleInvoicesTable.invoiceNumber,
      sourceId: saleInvoicesTable.id,
      party: saleInvoicesTable.partyName,
      qty: saleInvoiceItemsTable.quantity,
    }).from(saleInvoiceItemsTable)
      .innerJoin(saleInvoicesTable, eq(saleInvoiceItemsTable.invoiceId, saleInvoicesTable.id))
      .where(and(
        eq(saleInvoiceItemsTable.stockItemId, itemId),
        and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false)),
        ...addDateCond([], saleInvoicesTable.date),
      )),
    db.select({
      date: creditNotesTable.date,
      number: creditNotesTable.noteNumber,
      sourceId: creditNotesTable.id,
      party: creditNotesTable.partyName,
      qty: creditNoteItemsTable.quantity,
    }).from(creditNoteItemsTable)
      .innerJoin(creditNotesTable, eq(creditNoteItemsTable.noteId, creditNotesTable.id))
      .where(and(
        eq(creditNoteItemsTable.stockItemId, itemId),
        and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false)),
        ...addDateCond([], creditNotesTable.date),
      )),
    db.select({
      date: debitNotesTable.date,
      number: debitNotesTable.noteNumber,
      sourceId: debitNotesTable.id,
      party: debitNotesTable.partyName,
      qty: debitNoteItemsTable.quantity,
    }).from(debitNoteItemsTable)
      .innerJoin(debitNotesTable, eq(debitNoteItemsTable.noteId, debitNotesTable.id))
      .where(and(
        eq(debitNoteItemsTable.stockItemId, itemId),
        and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false)),
        ...addDateCond([], debitNotesTable.date),
      )),
  ]);

  const rows = [
    ...purchItems.map(r => ({ date: r.date, type: "Purchase Invoice", number: r.number, sourceId: r.sourceId, party: r.party, inQty: Number(r.qty), outQty: 0 })),
    ...saleItems.map(r => ({ date: r.date, type: "Sale Invoice", number: r.number, sourceId: r.sourceId, party: r.party, inQty: 0, outQty: Number(r.qty) })),
    ...cnItems.map(r => ({ date: r.date, type: "Credit Note", number: r.number, sourceId: r.sourceId, party: r.party, inQty: Number(r.qty), outQty: 0 })),
    ...dnItems.map(r => ({ date: r.date, type: "Debit Note", number: r.number, sourceId: r.sourceId, party: r.party, inQty: 0, outQty: Number(r.qty) })),
  ].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  const openingQty = Number(item[0].openingStock ?? 0);
  let balance = openingQty;
  const transactions = rows.map(r => {
    balance += r.inQty - r.outQty;
    return { ...r, balance };
  });

  res.json({
    item: { id: item[0].id, name: item[0].name, unit: item[0].unit },
    openingQty,
    closingQty: balance,
    transactions,
  });
});

// ── Batch / Unbatched-stock Ledger ───────────────────────────────────────────
// GET /reports/stock-batch-ledger?itemId=X&batchId=Y|null&from=...&to=...
router.get("/reports/stock-batch-ledger", authMiddleware, async (req, res) => {
    const enableDualLedger = await getEnableDualLedger();
  const itemId     = Number(req.query.itemId);
  const batchIdRaw = req.query.batchId as string | undefined;
  const batchId    = batchIdRaw === undefined || batchIdRaw === "null" ? null : Number(batchIdRaw);
  const { from, to } = req.query;

  if (!itemId) { res.status(400).json({ error: "itemId required" }); return; }

  const [itemRows, batchRows] = await Promise.all([
    db.select().from(stockItemsTable).where(eq(stockItemsTable.id, itemId)).limit(1),
    batchId !== null
      ? db.select().from(stockBatchesTable).where(eq(stockBatchesTable.id, batchId)).limit(1)
      : Promise.resolve([] as typeof stockBatchesTable.$inferSelect[]),
  ]);

  if (!itemRows.length) { res.status(404).json({ error: "Item not found" }); return; }
  const item  = itemRows[0];
  const batch = batchRows[0] ?? null;

  const addDate = (conds: any[], col: any) => {
    if (from) conds.push(gte(col, from as string));
    if (to)   conds.push(lte(col, to   as string));
    return conds;
  };

  const batchFilter = (col: any) =>
    batchId !== null ? eq(col, batchId) : isNull(col);

  const [purchItems, saleItems, cnItems, dnItems] = await Promise.all([
    // Purchases → inward, filtered by itemId + batchId
    db.select({
      date:     purchaseInvoicesTable.date,
      number:   purchaseInvoicesTable.invoiceNumber,
      sourceId: purchaseInvoicesTable.id,
      party:    purchaseInvoicesTable.partyName,
      qty:      purchaseInvoiceItemsTable.quantity,
      rate:     purchaseInvoiceItemsTable.rate,
      value:    purchaseInvoiceItemsTable.taxableAmount,
    }).from(purchaseInvoiceItemsTable)
      .innerJoin(purchaseInvoicesTable, eq(purchaseInvoiceItemsTable.invoiceId, purchaseInvoicesTable.id))
      .where(and(
        eq(purchaseInvoiceItemsTable.stockItemId, itemId),
        batchFilter(purchaseInvoiceItemsTable.batchId),
        and(eq(purchaseInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(purchaseInvoicesTable.isKaccha, false)),
        ...addDate([], purchaseInvoicesTable.date),
      )),

    // Sales → outward, filtered by itemId + batchId
    db.select({
      date:     saleInvoicesTable.date,
      number:   saleInvoicesTable.invoiceNumber,
      sourceId: saleInvoicesTable.id,
      party:    saleInvoicesTable.partyName,
      qty:      saleInvoiceItemsTable.quantity,
      rate:     saleInvoiceItemsTable.rate,
      value:    saleInvoiceItemsTable.taxableAmount,
    }).from(saleInvoiceItemsTable)
      .innerJoin(saleInvoicesTable, eq(saleInvoiceItemsTable.invoiceId, saleInvoicesTable.id))
      .where(and(
        eq(saleInvoiceItemsTable.stockItemId, itemId),
        batchFilter(saleInvoiceItemsTable.batchId),
        and(eq(saleInvoicesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(saleInvoicesTable.isKaccha, false)),
        ...addDate([], saleInvoicesTable.date),
      )),

    // Credit notes (sale returns → inward) — item-level only, shown for unbatched row
    batchId === null
      ? db.select({
          date:     creditNotesTable.date,
          number:   creditNotesTable.noteNumber,
          sourceId: creditNotesTable.id,
          party:    creditNotesTable.partyName,
          qty:      creditNoteItemsTable.quantity,
          rate:     creditNoteItemsTable.rate,
          value:    creditNoteItemsTable.taxableAmount,
        }).from(creditNoteItemsTable)
          .innerJoin(creditNotesTable, eq(creditNoteItemsTable.noteId, creditNotesTable.id))
          .where(and(
            eq(creditNoteItemsTable.stockItemId, itemId),
            and(eq(creditNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(creditNotesTable.isKaccha, false)),
            ...addDate([], creditNotesTable.date),
          ))
      : Promise.resolve([] as { date:string; number:string; sourceId:number; party:string; qty:string; rate:string; value:string }[]),

    // Debit notes (purchase returns → outward) — item-level only
    batchId === null
      ? db.select({
          date:     debitNotesTable.date,
          number:   debitNotesTable.noteNumber,
          sourceId: debitNotesTable.id,
          party:    debitNotesTable.partyName,
          qty:      debitNoteItemsTable.quantity,
          rate:     debitNoteItemsTable.rate,
          value:    debitNoteItemsTable.taxableAmount,
        }).from(debitNoteItemsTable)
          .innerJoin(debitNotesTable, eq(debitNoteItemsTable.noteId, debitNotesTable.id))
          .where(and(
            eq(debitNoteItemsTable.stockItemId, itemId),
            and(eq(debitNotesTable.isDeleted, "false"), enableDualLedger ? sql`true` : eq(debitNotesTable.isKaccha, false)),
            ...addDate([], debitNotesTable.date),
          ))
      : Promise.resolve([] as { date:string; number:string; sourceId:number; party:string; qty:string; rate:string; value:string }[]),
  ]);

  // Merge and sort all transactions by date
  const rows = [
    ...purchItems.map(r => ({ date: r.date, type: "Purchase Invoice", number: r.number, sourceId: r.sourceId, party: r.party, inQty: Number(r.qty), outQty: 0,            rate: Number(r.rate), value: Number(r.value) })),
    ...saleItems.map (r => ({ date: r.date, type: "Sale Invoice",     number: r.number, sourceId: r.sourceId, party: r.party, inQty: 0,            outQty: Number(r.qty), rate: Number(r.rate), value: Number(r.value) })),
    ...cnItems.map   (r => ({ date: r.date, type: "Credit Note",      number: r.number, sourceId: r.sourceId, party: r.party, inQty: Number(r.qty), outQty: 0,            rate: Number(r.rate), value: Number(r.value) })),
    ...dnItems.map   (r => ({ date: r.date, type: "Debit Note",       number: r.number, sourceId: r.sourceId, party: r.party, inQty: 0,            outQty: Number(r.qty), rate: Number(r.rate), value: Number(r.value) })),
  ].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  // Summary aggregates
  const inwardQty   = rows.reduce((s, r) => s + r.inQty,  0);
  const outwardQty  = rows.reduce((s, r) => s + r.outQty, 0);
  const inwardValue = rows.filter(r => r.inQty  > 0).reduce((s, r) => s + r.value, 0);
  const outwardValue= rows.filter(r => r.outQty > 0).reduce((s, r) => s + r.value, 0);

  const closingQty   = batch ? Number(batch.physicalStock) : Number(item.physicalStock);
  const openingQty   = closingQty - inwardQty + outwardQty;
  const baseRate     = Number(item.purchaseRate) || 0;
  const openingValue = openingQty * baseRate;
  const inwardRate   = inwardQty  > 0 ? inwardValue  / inwardQty  : 0;
  const outwardRate  = outwardQty > 0 ? outwardValue / outwardQty : 0;
  const avgDenom     = openingQty + inwardQty;
  const closingRate  = avgDenom > 0 ? (openingValue + inwardValue) / avgDenom : baseRate;
  const closingValue = closingQty * closingRate;

  // Build running balance
  let balance = openingQty;
  const transactions = rows.map(r => {
    balance += r.inQty - r.outQty;
    return { ...r, balance };
  });

  res.json({
    item:  { id: item.id, name: item.name, unit: item.unit, purchaseRate: Number(item.purchaseRate), saleRate: Number(item.saleRate) },
    batch: batch ? { id: batch.id, name: batch.name, expiryDate: batch.expiryDate, openingStock: Number(batch.openingStock), physicalStock: Number(batch.physicalStock) } : null,
    summary: { openingQty, openingRate: baseRate, openingValue, inwardQty, inwardRate, inwardValue, outwardQty, outwardRate, outwardValue, closingQty, closingRate, closingValue },
    transactions,
    period: { from: from || null, to: to || null },
  });
});

export default router;
