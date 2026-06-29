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

router.get("/dashboard/summary", authMiddleware, async (req, res) => {
  try {
    const today = todayStr();
    const mStart = monthStart();
    const { from, to } = req.query as { from?: string; to?: string };
    const periodFrom = from || mStart;
    const periodTo = to || today;

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

    const [periodSales] = await db
      .select({ total: sql<string>`COALESCE(SUM(grand_total), 0)` })
      .from(saleInvoicesTable)
      .where(and(
        gte(saleInvoicesTable.date, periodFrom),
        lte(saleInvoicesTable.date, periodTo),
        eq(saleInvoicesTable.isDeleted, "false")
      ));

    const [periodPurchases] = await db
      .select({ total: sql<string>`COALESCE(SUM(grand_total), 0)` })
      .from(purchaseInvoicesTable)
      .where(and(
        gte(purchaseInvoicesTable.date, periodFrom),
        lte(purchaseInvoicesTable.date, periodTo),
        eq(purchaseInvoicesTable.isDeleted, "false")
      ));

    const [periodCollections] = await db
      .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
      .from(receiptsTable)
      .where(and(
        gte(receiptsTable.date, periodFrom),
        lte(receiptsTable.date, periodTo),
        eq(receiptsTable.isDeleted, "false")
      ));

    res.json({
      todaySales: Number(todaySales.total),
      todayCollections: Number(todayCollections.total),
      openOrdersCount: openOrders.count,
      duePayables: Number(duePurchases.total),
      lowStockCount: lowStockCount.count,
      periodSales: Number(periodSales.total),
      periodPurchases: Number(periodPurchases.total),
      periodCollections: Number(periodCollections.total),
      periodFrom,
      periodTo,
    });
  } catch (err) {
    req.log?.error(err);
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

router.get("/dashboard/details", authMiddleware, async (req, res) => {
  try {
    const { type, from, to } = req.query as { type?: string; from?: string; to?: string };
    const today = todayStr();
    const periodFrom = from || monthStart();
    const periodTo = to || today;

    if (!type) return res.status(400).json({ error: "Missing type parameter" });

    let data: any[] = [];

    switch (type) {
      case "todaySales":
        data = await db
          .select({
            id: saleInvoicesTable.id,
            date: saleInvoicesTable.date,
            description: sql<string>`'Sale Invoice ' || invoice_number || ' - ' || party_name`,
            amount: saleInvoicesTable.grandTotal,
            status: saleInvoicesTable.status,
          })
          .from(saleInvoicesTable)
          .where(and(eq(saleInvoicesTable.date, today), eq(saleInvoicesTable.isDeleted, "false")))
          .orderBy(sql`created_at DESC`)
          .limit(50);
        break;

      case "periodSales":
        data = await db
          .select({
            id: saleInvoicesTable.id,
            date: saleInvoicesTable.date,
            description: sql<string>`'Sale Invoice ' || invoice_number || ' - ' || party_name`,
            amount: saleInvoicesTable.grandTotal,
            status: saleInvoicesTable.status,
          })
          .from(saleInvoicesTable)
          .where(and(
            gte(saleInvoicesTable.date, periodFrom),
            lte(saleInvoicesTable.date, periodTo),
            eq(saleInvoicesTable.isDeleted, "false")
          ))
          .orderBy(sql`created_at DESC`)
          .limit(50);
        break;

      case "periodPurchases":
        data = await db
          .select({
            id: purchaseInvoicesTable.id,
            date: purchaseInvoicesTable.date,
            description: sql<string>`'Purchase Invoice ' || invoice_number || ' - ' || party_name`,
            amount: purchaseInvoicesTable.grandTotal,
            status: purchaseInvoicesTable.status,
          })
          .from(purchaseInvoicesTable)
          .where(and(
            gte(purchaseInvoicesTable.date, periodFrom),
            lte(purchaseInvoicesTable.date, periodTo),
            eq(purchaseInvoicesTable.isDeleted, "false")
          ))
          .orderBy(sql`created_at DESC`)
          .limit(50);
        break;

      case "todayCollections":
        data = await db
          .select({
            id: receiptsTable.id,
            date: receiptsTable.date,
            description: sql<string>`'Receipt ' || voucher_number || CASE WHEN party_name IS NOT NULL THEN ' - ' || party_name ELSE '' END`,
            amount: receiptsTable.amount,
          })
          .from(receiptsTable)
          .where(and(eq(receiptsTable.date, today), eq(receiptsTable.isDeleted, "false")))
          .orderBy(sql`created_at DESC`)
          .limit(50);
        break;

      case "periodCollections":
        data = await db
          .select({
            id: receiptsTable.id,
            date: receiptsTable.date,
            description: sql<string>`'Receipt ' || voucher_number || CASE WHEN party_name IS NOT NULL THEN ' - ' || party_name ELSE '' END`,
            amount: receiptsTable.amount,
          })
          .from(receiptsTable)
          .where(and(
            gte(receiptsTable.date, periodFrom),
            lte(receiptsTable.date, periodTo),
            eq(receiptsTable.isDeleted, "false")
          ))
          .orderBy(sql`created_at DESC`)
          .limit(50);
        break;

      case "openOrders":
        data = await db
          .select({
            id: ordersTable.id,
            date: ordersTable.date,
            description: sql<string>`'Order ' || order_number || ' - ' || party_name`,
            amount: ordersTable.grandTotal,
            status: ordersTable.status,
          })
          .from(ordersTable)
          .where(and(eq(ordersTable.status, "pending"), eq(ordersTable.isDeleted, "false")))
          .orderBy(sql`created_at DESC`)
          .limit(50);
        break;

      case "duePayables":
        data = await db
          .select({
            id: purchaseInvoicesTable.id,
            date: purchaseInvoicesTable.date,
            description: sql<string>`'Purchase Invoice ' || invoice_number || ' - ' || party_name`,
            amount: purchaseInvoicesTable.balanceDue,
            status: purchaseInvoicesTable.status,
          })
          .from(purchaseInvoicesTable)
          .where(and(eq(purchaseInvoicesTable.isDeleted, "false"), sql`balance_due::numeric > 0`))
          .orderBy(sql`created_at DESC`)
          .limit(50);
        break;

      case "lowStock":
        data = await db
          .select({
            id: stockItemsTable.id,
            date: sql<string>`CURRENT_DATE::text`,
            description: sql<string>`name || ' (Stock: ' || physical_stock || ' ' || unit || ')'`,
            amount: sql<number>`0`,
          })
          .from(stockItemsTable)
          .where(and(
            eq(stockItemsTable.isDeleted, "false"),
            sql`physical_stock::numeric <= min_stock_level::numeric`
          ))
          .limit(50);
        break;

      default:
        return res.status(400).json({ error: "Invalid type parameter" });
    }

    res.json(data.map(d => ({ ...d, amount: Number(d.amount) })));
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
