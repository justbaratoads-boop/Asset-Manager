import { Router } from "express";
import { db } from "@workspace/db";
import {
  saleInvoicesTable, saleInvoiceItemsTable, purchaseInvoicesTable, purchaseInvoiceItemsTable,
  saleInvoicePaymentsTable, purchaseInvoicePaymentsTable,
  paymentsTable, receiptsTable, journalEntriesTable, journalLinesTable,
  ledgersTable, stockItemsTable, ordersTable,
  creditNotesTable, debitNotesTable, creditNoteItemsTable, debitNoteItemsTable
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

router.get("/reports/day-book", authMiddleware, async (req, res) => {
  const { date } = req.query;
  const d = (date as string) || new Date().toISOString().slice(0, 10);

  const sales = await db.select({
    type: sql<string>`'Sale Invoice'`,
    number: saleInvoicesTable.invoiceNumber,
    party: saleInvoicesTable.partyName,
    dr: saleInvoicesTable.grandTotal,
    cr: sql<string>`'0'`,
    date: saleInvoicesTable.date,
  }).from(saleInvoicesTable).where(and(eq(saleInvoicesTable.date, d), eq(saleInvoicesTable.isDeleted, "false")));

  const purchases = await db.select({
    type: sql<string>`'Purchase Invoice'`,
    number: purchaseInvoicesTable.invoiceNumber,
    party: purchaseInvoicesTable.partyName,
    dr: sql<string>`'0'`,
    cr: purchaseInvoicesTable.grandTotal,
    date: purchaseInvoicesTable.date,
  }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.date, d), eq(purchaseInvoicesTable.isDeleted, "false")));

  const pmts = await db.select({
    type: sql<string>`'Payment'`,
    number: paymentsTable.voucherNumber,
    party: paymentsTable.partyName,
    dr: paymentsTable.amount,
    cr: sql<string>`'0'`,
    date: paymentsTable.date,
  }).from(paymentsTable).where(and(eq(paymentsTable.date, d), eq(paymentsTable.isDeleted, "false")));

  const rcts = await db.select({
    type: sql<string>`'Receipt'`,
    number: receiptsTable.voucherNumber,
    party: receiptsTable.partyName,
    dr: sql<string>`'0'`,
    cr: receiptsTable.amount,
    date: receiptsTable.date,
  }).from(receiptsTable).where(and(eq(receiptsTable.date, d), eq(receiptsTable.isDeleted, "false")));

  const all = [...sales, ...purchases, ...pmts, ...rcts].map(r => ({
    ...r,
    dr: Number(r.dr),
    cr: Number(r.cr),
  }));

  res.json({ date: d, entries: all, totalDr: all.reduce((s, r) => s + r.dr, 0), totalCr: all.reduce((s, r) => s + r.cr, 0) });
});

router.get("/reports/trial-balance", authMiddleware, async (req, res) => {
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
    db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false")),
    db
      .select({ line: journalLinesTable })
      .from(journalLinesTable)
      .innerJoin(
        journalEntriesTable,
        and(
          eq(journalLinesTable.entryId, journalEntriesTable.id),
          eq(journalEntriesTable.isDeleted, "false"),
        ),
      ),
    db.select().from(saleInvoicesTable).where(eq(saleInvoicesTable.isDeleted, "false")),
    db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.isDeleted, "false")),
    db.select().from(receiptsTable).where(eq(receiptsTable.isDeleted, "false")),
    db.select().from(paymentsTable).where(eq(paymentsTable.isDeleted, "false")),
    db.select().from(creditNotesTable).where(eq(creditNotesTable.isDeleted, "false")),
    db.select().from(debitNotesTable).where(eq(debitNotesTable.isDeleted, "false")),
    // Inline payments recorded directly on sale invoices
    db.select({
      mode: saleInvoicePaymentsTable.mode,
      amount: saleInvoicePaymentsTable.amount,
    }).from(saleInvoicePaymentsTable)
      .innerJoin(saleInvoicesTable, and(
        eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id),
        eq(saleInvoicesTable.isDeleted, "false"),
      )),
    // Inline payments recorded directly on purchase invoices
    db.select({
      mode: purchaseInvoicePaymentsTable.mode,
      amount: purchaseInvoicePaymentsTable.amount,
    }).from(purchaseInvoicePaymentsTable)
      .innerJoin(purchaseInvoicesTable, and(
        eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id),
        eq(purchaseInvoicesTable.isDeleted, "false"),
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
    cgstPayable: byName("CGST Payable")        ?? 20,
    sgstPayable: byName("SGST Payable")        ?? 21,
    igstPayable: byName("IGST Payable")        ?? 22,
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
    add(inv.partyId ? LEDGER.ar : LEDGER.cash, "dr", grandTotal);
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
    add(inv.partyId ? LEDGER.ap : LEDGER.cash, "cr", grandTotal);
  }

  // 4. Receipts (money received from customers)
  //    Dr: ledger_id (cash/bank account where money came in)
  //    Cr: Accounts Receivable (reduces what the customer owes)
  for (const r of receipts) {
    const amount = Number(r.amount);
    add(r.ledgerId, "dr", amount);
    add(LEDGER.ar, "cr", amount);
  }

  // 5. Payments (money paid to suppliers)
  //    Dr: Accounts Payable (reduces what we owe the supplier)
  //    Cr: ledger_id (cash/bank account from which money went out)
  for (const p of payments) {
    const amount = Number(p.amount);
    add(LEDGER.ap, "dr", amount);
    add(p.ledgerId, "cr", amount);
  }

  // 6. Credit notes (sale returns) — reversal of a sale
  //    Dr: Sales (reduces revenue)
  //    Cr: Accounts Receivable (customer owes less / gets refund)
  for (const cn of creditNotes) {
    const amount = Number(cn.amount);
    add(LEDGER.sales, "dr", amount);
    add(LEDGER.ar, "cr", amount);
  }

  // 7. Debit notes (purchase returns) — reversal of a purchase
  //    Dr: Accounts Payable (we owe supplier less)
  //    Cr: Purchase (reduces purchase expense)
  for (const dn of debitNotes) {
    const amount = Number(dn.amount);
    add(LEDGER.ap, "dr", amount);
    add(LEDGER.purchase, "cr", amount);
  }

  // Helper: map a payment mode string to a ledger ID.
  // "cash" → Cash; named bank accounts → find by ledger name; fallback → Cash.
  const modeToLedgerId = (mode: string): number => {
    if (!mode || mode.toLowerCase() === "cash" || mode.toLowerCase() === "upi" || mode.toLowerCase() === "cheque") {
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
    add(LEDGER.ar, "cr", amount);
  }

  // 9. Inline purchase-invoice payments (recorded on purchase invoice form)
  //    These reduce what we owe the supplier — same effect as a standalone Payment voucher.
  //    Dr: Accounts Payable
  //    Cr: Cash / Bank (mode-mapped)
  for (const p of purchaseInvoicePayments) {
    const amount = Number(p.amount);
    add(LEDGER.ap, "dr", amount);
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
  const { from, to } = req.query;

  const saleCond: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
  if (from) saleCond.push(gte(saleInvoicesTable.date, from as string));
  if (to) saleCond.push(lte(saleInvoicesTable.date, to as string));

  const purCond: any[] = [eq(purchaseInvoicesTable.isDeleted, "false")];
  if (from) purCond.push(gte(purchaseInvoicesTable.date, from as string));
  if (to) purCond.push(lte(purchaseInvoicesTable.date, to as string));

  const cnCond: any[] = [eq(creditNotesTable.isDeleted, "false")];
  if (from) cnCond.push(gte(creditNotesTable.date, from as string));
  if (to) cnCond.push(lte(creditNotesTable.date, to as string));

  const dnCond: any[] = [eq(debitNotesTable.isDeleted, "false")];
  if (from) dnCond.push(gte(debitNotesTable.date, from as string));
  if (to) dnCond.push(lte(debitNotesTable.date, to as string));

  const jeCond: any[] = [eq(journalEntriesTable.isDeleted, "false")];
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
    db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false")),
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
    db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false")),
    db
      .select({ line: journalLinesTable })
      .from(journalLinesTable)
      .innerJoin(
        journalEntriesTable,
        and(
          eq(journalLinesTable.entryId, journalEntriesTable.id),
          eq(journalEntriesTable.isDeleted, "false"),
        ),
      ),
    db.select().from(saleInvoicesTable).where(eq(saleInvoicesTable.isDeleted, "false")),
    db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.isDeleted, "false")),
    db.select().from(receiptsTable).where(eq(receiptsTable.isDeleted, "false")),
    db.select().from(paymentsTable).where(eq(paymentsTable.isDeleted, "false")),
    db.select().from(creditNotesTable).where(eq(creditNotesTable.isDeleted, "false")),
    db.select().from(debitNotesTable).where(eq(debitNotesTable.isDeleted, "false")),
    db.select({
      mode: saleInvoicePaymentsTable.mode,
      amount: saleInvoicePaymentsTable.amount,
    }).from(saleInvoicePaymentsTable)
      .innerJoin(saleInvoicesTable, and(
        eq(saleInvoicePaymentsTable.invoiceId, saleInvoicesTable.id),
        eq(saleInvoicesTable.isDeleted, "false"),
      )),
    db.select({
      mode: purchaseInvoicePaymentsTable.mode,
      amount: purchaseInvoicePaymentsTable.amount,
    }).from(purchaseInvoicePaymentsTable)
      .innerJoin(purchaseInvoicesTable, and(
        eq(purchaseInvoicePaymentsTable.invoiceId, purchaseInvoicesTable.id),
        eq(purchaseInvoicesTable.isDeleted, "false"),
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
    cgstPayable: byName("CGST Payable")        ?? 20,
    sgstPayable: byName("SGST Payable")        ?? 21,
    igstPayable: byName("IGST Payable")        ?? 22,
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
    add(inv.partyId ? LEDGER.ar : LEDGER.cash, "dr", grandTotal);
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
    add(inv.partyId ? LEDGER.ap : LEDGER.cash, "cr", grandTotal);
  }

  // 4. Receipts: Dr ledger (cash/bank), Cr AR
  for (const r of receipts) {
    add(r.ledgerId, "dr", Number(r.amount));
    add(LEDGER.ar, "cr", Number(r.amount));
  }

  // 5. Payments: Dr AP, Cr ledger (cash/bank)
  for (const p of payments) {
    add(LEDGER.ap, "dr", Number(p.amount));
    add(p.ledgerId, "cr", Number(p.amount));
  }

  // 6. Credit notes (sale returns): Dr Sales, Cr AR
  for (const cn of creditNotes) {
    add(LEDGER.sales, "dr", Number(cn.amount));
    add(LEDGER.ar, "cr", Number(cn.amount));
  }

  // 7. Debit notes (purchase returns): Dr AP, Cr Purchase
  for (const dn of debitNotes) {
    add(LEDGER.ap, "dr", Number(dn.amount));
    add(LEDGER.purchase, "cr", Number(dn.amount));
  }

  // 8. Inline sale-invoice payments: Dr Cash/Bank, Cr AR
  const modeToLedgerId = (mode: string): number => {
    if (!mode || mode.toLowerCase() === "cash" || mode.toLowerCase() === "upi" || mode.toLowerCase() === "cheque") {
      return LEDGER.cash;
    }
    return byName(mode) ?? LEDGER.cash;
  };
  for (const p of saleInvoicePayments) {
    add(modeToLedgerId(p.mode), "dr", Number(p.amount));
    add(LEDGER.ar, "cr", Number(p.amount));
  }

  // 9. Inline purchase-invoice payments: Dr AP, Cr Cash/Bank
  for (const p of purchaseInvoicePayments) {
    add(LEDGER.ap, "dr", Number(p.amount));
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
  const { from, to } = req.query;
  const conditions: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
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
  const { from, to } = req.query;
  const conditions: any[] = [eq(purchaseInvoicesTable.isDeleted, "false")];
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
  const { from, to } = req.query;
  const pmtCond: any[] = [eq(paymentsTable.isDeleted, "false"), eq(paymentsTable.paymentMode, "cash")];
  const rctCond: any[] = [eq(receiptsTable.isDeleted, "false"), eq(receiptsTable.paymentMode, "cash")];
  if (from) { pmtCond.push(gte(paymentsTable.date, from as string)); rctCond.push(gte(receiptsTable.date, from as string)); }
  if (to) { pmtCond.push(lte(paymentsTable.date, to as string)); rctCond.push(lte(receiptsTable.date, to as string)); }

  const pmts = await db.select().from(paymentsTable).where(and(...pmtCond));
  const rcts = await db.select().from(receiptsTable).where(and(...rctCond));

  const out = pmts.map(p => ({ date: p.date, type: "payment" as const, ref: p.voucherNumber, party: p.partyName || "", description: p.narration || `Payment to ${p.partyName || ""}`, cashIn: 0, cashOut: Number(p.amount) }));
  const inc = rcts.map(r => ({ date: r.date, type: "receipt" as const, ref: r.voucherNumber, party: r.partyName || "", description: r.narration || `Receipt from ${r.partyName || ""}`, cashIn: Number(r.amount), cashOut: 0 }));
  const sorted = [...out, ...inc].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  let balance = 0;
  const entries = sorted.map(e => {
    balance += e.cashIn - e.cashOut;
    return { ...e, balance };
  });

  res.json({ entries, totalOut: out.reduce((s, r) => s + r.cashOut, 0), totalIn: inc.reduce((s, r) => s + r.cashIn, 0) });
});

router.get("/reports/all-transactions", authMiddleware, async (req, res) => {
  const { from, to } = req.query;

  const addCond = (conditions: any[], dateField: any) => {
    if (from) conditions.push(gte(dateField, from as string));
    if (to) conditions.push(lte(dateField, to as string));
    return conditions;
  };

  const saleCond = addCond([eq(saleInvoicesTable.isDeleted, "false")], saleInvoicesTable.date);
  const purCond = addCond([eq(purchaseInvoicesTable.isDeleted, "false")], purchaseInvoicesTable.date);
  const pmtCond = addCond([eq(paymentsTable.isDeleted, "false")], paymentsTable.date);
  const rctCond = addCond([eq(receiptsTable.isDeleted, "false")], receiptsTable.date);
  const jeCond = addCond([eq(journalEntriesTable.isDeleted, "false")], journalEntriesTable.date);
  const orderCond = addCond([eq(ordersTable.isDeleted, "false")], ordersTable.date);
  const cnCond = addCond([eq(creditNotesTable.isDeleted, "false")], creditNotesTable.date);
  const dnCond = addCond([eq(debitNotesTable.isDeleted, "false")], debitNotesTable.date);

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
    ...sales.map(i => ({ date: i.date, type: "Sale Invoice", number: i.invoiceNumber, party: i.partyName, amount: Number(i.grandTotal), debit: Number(i.grandTotal), credit: 0 })),
    ...purchases.map(i => ({ date: i.date, type: "Purchase Invoice", number: i.invoiceNumber, party: i.partyName, amount: Number(i.grandTotal), debit: 0, credit: Number(i.grandTotal) })),
    ...payments.map(p => ({ date: p.date, type: "Payment", number: p.voucherNumber, party: p.partyName || "", amount: Number(p.amount), debit: Number(p.amount), credit: 0 })),
    ...receipts.map(r => ({ date: r.date, type: "Receipt", number: r.voucherNumber, party: r.partyName || "", amount: Number(r.amount), debit: 0, credit: Number(r.amount) })),
    ...journals.map(j => ({ date: j.date, type: "Journal", number: j.voucherNumber, party: j.narration || "", amount: Number(j.totalDebit), debit: Number(j.totalDebit), credit: Number(j.totalCredit) })),
    ...orders.map(o => ({ date: o.date, type: "Order", number: o.orderNumber, party: o.partyName, amount: Number(o.grandTotal), debit: 0, credit: 0 })),
    ...creditNotes.map(c => ({ date: c.date, type: "Credit Note", number: c.noteNumber, party: c.partyName, amount: Number(c.amount), debit: 0, credit: Number(c.amount) })),
    ...debitNotes.map(d => ({ date: d.date, type: "Debit Note", number: d.noteNumber, party: d.partyName, amount: Number(d.amount), debit: Number(d.amount), credit: 0 })),
  ].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  res.json({ transactions: all, count: all.length });
});

router.get("/reports/party-statement", authMiddleware, async (req, res) => {
  const { partyId, from, to } = req.query;
  if (!partyId) { res.json({ transactions: [], openingBalance: 0, closingBalance: 0 }); return; }

  const pid = Number(partyId);
  const addCond = (conditions: any[], dateField: any) => {
    if (from) conditions.push(gte(dateField, from as string));
    if (to) conditions.push(lte(dateField, to as string));
    return conditions;
  };

  const saleCond = addCond([eq(saleInvoicesTable.isDeleted, "false"), sql`party_id = ${pid}`], saleInvoicesTable.date);
  const purCond = addCond([eq(purchaseInvoicesTable.isDeleted, "false"), sql`party_id = ${pid}`], purchaseInvoicesTable.date);
  const pmtCond = addCond([eq(paymentsTable.isDeleted, "false"), sql`party_id = ${pid}`], paymentsTable.date);
  const rctCond = addCond([eq(receiptsTable.isDeleted, "false"), sql`party_id = ${pid}`], receiptsTable.date);

  const [sales, purchases, payments, receipts] = await Promise.all([
    db.select().from(saleInvoicesTable).where(and(...saleCond)),
    db.select().from(purchaseInvoicesTable).where(and(...purCond)),
    db.select().from(paymentsTable).where(and(...pmtCond)),
    db.select().from(receiptsTable).where(and(...rctCond)),
  ]);

  const all = [
    ...sales.map(i => ({ date: i.date, type: "Sale Invoice", number: i.invoiceNumber, debit: Number(i.grandTotal), credit: 0 })),
    ...purchases.map(i => ({ date: i.date, type: "Purchase Invoice", number: i.invoiceNumber, debit: 0, credit: Number(i.grandTotal) })),
    ...payments.map(p => ({ date: p.date, type: "Payment", number: p.voucherNumber, debit: Number(p.amount), credit: 0 })),
    ...receipts.map(r => ({ date: r.date, type: "Receipt", number: r.voucherNumber, debit: 0, credit: Number(r.amount) })),
  ].sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  let balance = 0;
  const transactions = all.map(t => {
    balance += t.debit - t.credit;
    return { ...t, balance };
  });

  res.json({ transactions, closingBalance: balance });
});

router.get("/reports/stock-summary", authMiddleware, async (req, res) => {
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
      eq(purchaseInvoicesTable.isDeleted, "false"),
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
      eq(saleInvoicesTable.isDeleted, "false"),
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
      eq(creditNotesTable.isDeleted, "false"),
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
      eq(debitNotesTable.isDeleted, "false"),
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

router.get("/reports/delivery-report", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const conditions: any[] = [eq(ordersTable.isDeleted, "false")];
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
  const items = await db.select().from(stockItemsTable).where(eq(stockItemsTable.isDeleted, "false")).orderBy(stockItemsTable.name);
  res.json(items.map(i => ({
    id: i.id, name: i.name, unit: i.unit, hsnCode: i.hsnCode,
    physicalStock: Number(i.physicalStock),
    minStockLevel: Number(i.minStockLevel),
    purchaseRate: Number(i.purchaseRate),
    saleRate: Number(i.saleRate),
    value: Number(i.physicalStock) * Number(i.purchaseRate),
    isLow: Number(i.physicalStock) <= Number(i.minStockLevel),
  })));
});

router.get("/stock-availability", authMiddleware, async (req, res) => {
  const result = await db.execute(sql`
    SELECT
      si.id,
      si.name,
      si.unit,
      si.hsn_code AS "hsnCode",
      si.physical_stock::numeric AS "physicalStock",
      si.purchase_rate::numeric AS "purchaseRate",
      si.sale_rate::numeric AS "saleRate",
      si.min_stock_level::numeric AS "minStockLevel",
      COALESCE(reserved.qty, 0)::numeric AS "reservedQty"
    FROM stock_items si
    LEFT JOIN (
      SELECT oi.stock_item_id, SUM(oi.quantity::numeric) AS qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.converted_invoice_id IS NULL
        AND o.status = 'pending'
        AND o.is_deleted = 'false'
      GROUP BY oi.stock_item_id
    ) AS reserved ON reserved.stock_item_id = si.id
    WHERE si.is_deleted = 'false'
    ORDER BY si.name
  `);
  res.json(result.rows.map((r: any) => ({
    id: Number(r.id),
    name: r.name,
    unit: r.unit,
    hsnCode: r.hsnCode,
    physicalStock: Number(r.physicalStock),
    reservedQty: Number(r.reservedQty),
    availableStock: Number(r.physicalStock) - Number(r.reservedQty),
    purchaseRate: Number(r.purchaseRate),
    saleRate: Number(r.saleRate),
    minStockLevel: Number(r.minStockLevel),
  })));
});

export default router;
