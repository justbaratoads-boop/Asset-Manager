import { Router } from "express";
import { db } from "@workspace/db";
import {
  saleInvoicesTable, purchaseInvoicesTable, ordersTable,
  paymentsTable, receiptsTable, stockItemsTable, journalEntriesTable
} from "@workspace/db/schema";
import { eq, gte, lte, and, lt, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

router.get("/dashboard/summary", authMiddleware, async (_req, res) => {
  try {
    const today = todayStr();
    const mStart = monthStart();

    const [todaySales] = await db
      .select({ total: sql<string>`COALESCE(SUM(grand_total), 0)` })
      .from(saleInvoicesTable)
      .where(and(eq(saleInvoicesTable.date, today), eq(saleInvoicesTable.isDeleted, "false")));

    const [todayCollections] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(receiptsTable)
      .where(and(eq(receiptsTable.date, today), eq(receiptsTable.isDeleted, "false")));

    const [openOrders] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(ordersTable)
      .where(and(eq(ordersTable.status, "pending"), eq(ordersTable.isDeleted, "false")));

    const [duePurchases] = await db
      .select({ total: sql<string>`COALESCE(SUM(balance_due), 0)` })
      .from(purchaseInvoicesTable)
      .where(and(eq(purchaseInvoicesTable.isDeleted, "false")));

    const [lowStockCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(stockItemsTable)
      .where(and(
        eq(stockItemsTable.isDeleted, "false"),
        sql`physical_stock::numeric <= min_stock_level::numeric`
      ));

    const [monthSales] = await db
      .select({ total: sql<string>`COALESCE(SUM(grand_total), 0)` })
      .from(saleInvoicesTable)
      .where(and(
        gte(saleInvoicesTable.date, mStart),
        lte(saleInvoicesTable.date, today),
        eq(saleInvoicesTable.isDeleted, "false")
      ));

    const [monthPurchases] = await db
      .select({ total: sql<string>`COALESCE(SUM(grand_total), 0)` })
      .from(purchaseInvoicesTable)
      .where(and(
        gte(purchaseInvoicesTable.date, mStart),
        lte(purchaseInvoicesTable.date, today),
        eq(purchaseInvoicesTable.isDeleted, "false")
      ));

    res.json({
      todaySales: Number(todaySales.total),
      todayCollections: Number(todayCollections.total),
      openOrdersCount: openOrders.count,
      duePayables: Number(duePurchases.total),
      lowStockCount: lowStockCount.count,
      monthSales: Number(monthSales.total),
      monthPurchases: Number(monthPurchases.total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-activity", authMiddleware, async (_req, res) => {
  try {
    const invoices = await db
      .select({
        id: saleInvoicesTable.id,
        date: saleInvoicesTable.date,
        description: sql<string>`'Sale Invoice ' || invoice_number || ' - ' || party_name`,
        amount: saleInvoicesTable.grandTotal,
        type: sql<string>`'sale_invoice'`,
      })
      .from(saleInvoicesTable)
      .where(eq(saleInvoicesTable.isDeleted, "false"))
      .orderBy(sql`created_at DESC`)
      .limit(5);

    const payments = await db
      .select({
        id: paymentsTable.id,
        date: paymentsTable.date,
        description: sql<string>`'Payment ' || voucher_number || CASE WHEN party_name IS NOT NULL THEN ' - ' || party_name ELSE '' END`,
        amount: paymentsTable.amount,
        type: sql<string>`'payment'`,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.isDeleted, "false"))
      .orderBy(sql`created_at DESC`)
      .limit(5);

    const receipts = await db
      .select({
        id: receiptsTable.id,
        date: receiptsTable.date,
        description: sql<string>`'Receipt ' || voucher_number || CASE WHEN party_name IS NOT NULL THEN ' - ' || party_name ELSE '' END`,
        amount: receiptsTable.amount,
        type: sql<string>`'receipt'`,
      })
      .from(receiptsTable)
      .where(eq(receiptsTable.isDeleted, "false"))
      .orderBy(sql`created_at DESC`)
      .limit(5);

    const all = [...invoices, ...payments, ...receipts]
      .map(r => ({ ...r, amount: Number(r.amount) }))
      .sort((a, b) => (b.date > a.date ? 1 : -1))
      .slice(0, 10);

    res.json(all);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/low-stock-alerts", authMiddleware, async (_req, res) => {
  try {
    const items = await db
      .select({
        id: stockItemsTable.id,
        name: stockItemsTable.name,
        physicalStock: stockItemsTable.physicalStock,
        minStockLevel: stockItemsTable.minStockLevel,
        unit: stockItemsTable.unit,
      })
      .from(stockItemsTable)
      .where(and(
        eq(stockItemsTable.isDeleted, "false"),
        sql`physical_stock::numeric <= min_stock_level::numeric`
      ))
      .limit(20);

    res.json(items.map(i => ({
      ...i,
      physicalStock: Number(i.physicalStock),
      minStockLevel: Number(i.minStockLevel),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
