import { Router } from "express";
import { db } from "@workspace/db";
import {
  saleInvoicesTable, saleInvoiceItemsTable, purchaseInvoicesTable, purchaseInvoiceItemsTable,
  paymentsTable, receiptsTable, journalEntriesTable, journalLinesTable,
  ledgersTable, stockItemsTable
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
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
  const ledgers = await db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false"));
  const lines = await db.select().from(journalLinesTable);

  const balances: Record<number, { dr: number; cr: number }> = {};
  for (const line of lines) {
    if (!balances[line.ledgerId]) balances[line.ledgerId] = { dr: 0, cr: 0 };
    if (line.type === "dr") balances[line.ledgerId].dr += Number(line.amount);
    else balances[line.ledgerId].cr += Number(line.amount);
  }

  const rows = ledgers.map(l => {
    const b = balances[l.id] || { dr: 0, cr: 0 };
    const opening = Number(l.openingBalance);
    const netDr = b.dr + (l.nature === "dr" ? opening : 0);
    const netCr = b.cr + (l.nature === "cr" ? opening : 0);
    return { id: l.id, name: l.name, group: l.group, nature: l.nature, openingBalance: opening, debit: netDr, credit: netCr, closing: netDr - netCr };
  });

  res.json({ rows, totalDebit: rows.reduce((s, r) => s + r.debit, 0), totalCredit: rows.reduce((s, r) => s + r.credit, 0) });
});

router.get("/reports/profit-loss", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const conditions: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
  if (from) conditions.push(gte(saleInvoicesTable.date, from as string));
  if (to) conditions.push(lte(saleInvoicesTable.date, to as string));

  const [sales] = await db.select({ total: sql<string>`COALESCE(SUM(grand_total), 0)` }).from(saleInvoicesTable).where(and(...conditions));
  const purCond: any[] = [eq(purchaseInvoicesTable.isDeleted, "false")];
  if (from) purCond.push(gte(purchaseInvoicesTable.date, from as string));
  if (to) purCond.push(lte(purchaseInvoicesTable.date, to as string));
  const [purchases] = await db.select({ total: sql<string>`COALESCE(SUM(grand_total), 0)` }).from(purchaseInvoicesTable).where(and(...purCond));

  const totalSales = Number(sales.total);
  const totalPurchases = Number(purchases.total);
  const grossProfit = totalSales - totalPurchases;

  res.json({
    period: { from: from || null, to: to || null },
    income: { sales: totalSales, total: totalSales },
    expenses: { purchases: totalPurchases, total: totalPurchases },
    grossProfit,
    netProfit: grossProfit,
  });
});

router.get("/reports/balance-sheet", authMiddleware, async (req, res) => {
  const ledgers = await db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false"));
  const lines = await db.select().from(journalLinesTable);

  const balances: Record<number, number> = {};
  for (const line of lines) {
    if (!balances[line.ledgerId]) balances[line.ledgerId] = 0;
    balances[line.ledgerId] += line.type === "dr" ? Number(line.amount) : -Number(line.amount);
  }

  const assets = ledgers.filter(l => l.group === "assets").map(l => ({ name: l.name, amount: Number(l.openingBalance) + (balances[l.id] || 0) }));
  const liabilities = ledgers.filter(l => l.group === "liabilities").map(l => ({ name: l.name, amount: Number(l.openingBalance) + (balances[l.id] || 0) }));
  const capital = ledgers.filter(l => l.group === "capital").map(l => ({ name: l.name, amount: Number(l.openingBalance) + (balances[l.id] || 0) }));

  res.json({
    assets: { items: assets, total: assets.reduce((s, a) => s + a.amount, 0) },
    liabilities: { items: liabilities, total: liabilities.reduce((s, l) => s + l.amount, 0) },
    capital: { items: capital, total: capital.reduce((s, c) => s + c.amount, 0) },
  });
});

router.get("/reports/sale-register", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const conditions: any[] = [eq(saleInvoicesTable.isDeleted, "false")];
  if (from) conditions.push(gte(saleInvoicesTable.date, from as string));
  if (to) conditions.push(lte(saleInvoicesTable.date, to as string));

  const invoices = await db.select().from(saleInvoicesTable).where(and(...conditions)).orderBy(sql`date ASC`);

  res.json(invoices.map(i => ({
    invoiceNumber: i.invoiceNumber,
    date: i.date,
    partyName: i.partyName,
    taxable: Number(i.totalTaxable),
    cgst: Number(i.totalCgst),
    sgst: Number(i.totalSgst),
    igst: Number(i.totalIgst),
    grandTotal: Number(i.grandTotal),
  })));
});

router.get("/reports/purchase-register", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const conditions: any[] = [eq(purchaseInvoicesTable.isDeleted, "false")];
  if (from) conditions.push(gte(purchaseInvoicesTable.date, from as string));
  if (to) conditions.push(lte(purchaseInvoicesTable.date, to as string));

  const invoices = await db.select().from(purchaseInvoicesTable).where(and(...conditions)).orderBy(sql`date ASC`);

  res.json(invoices.map(i => ({
    invoiceNumber: i.invoiceNumber,
    date: i.date,
    partyName: i.partyName,
    taxable: Number(i.totalTaxable),
    cgst: Number(i.totalCgst),
    sgst: Number(i.totalSgst),
    igst: Number(i.totalIgst),
    grandTotal: Number(i.grandTotal),
  })));
});

router.get("/reports/cash-book", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const pmtCond: any[] = [eq(paymentsTable.isDeleted, "false"), eq(paymentsTable.paymentMode, "cash")];
  const rctCond: any[] = [eq(receiptsTable.isDeleted, "false"), eq(receiptsTable.paymentMode, "cash")];
  if (from) { pmtCond.push(gte(paymentsTable.date, from as string)); rctCond.push(gte(receiptsTable.date, from as string)); }
  if (to) { pmtCond.push(lte(paymentsTable.date, to as string)); rctCond.push(lte(receiptsTable.date, to as string)); }

  const pmts = await db.select().from(paymentsTable).where(and(...pmtCond));
  const rcts = await db.select().from(receiptsTable).where(and(...rctCond));

  const out = pmts.map(p => ({ date: p.date, type: "payment", ref: p.voucherNumber, party: p.partyName || "", dr: Number(p.amount), cr: 0 }));
  const inc = rcts.map(r => ({ date: r.date, type: "receipt", ref: r.voucherNumber, party: r.partyName || "", dr: 0, cr: Number(r.amount) }));
  const all = [...out, ...inc].sort((a, b) => a.date > b.date ? 1 : -1);

  res.json({ entries: all, totalOut: out.reduce((s, r) => s + r.dr, 0), totalIn: inc.reduce((s, r) => s + r.cr, 0) });
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

export default router;
