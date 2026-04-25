import { Router } from "express";
import { db } from "@workspace/db";
import { stockCategoriesTable, stockItemsTable, stockTransactionsTable } from "@workspace/db/schema";
import { eq, and, like, lte, sql } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

// ---- CATEGORIES ----
router.get("/stock-categories", authMiddleware, async (_req, res) => {
  const cats = await db.select().from(stockCategoriesTable).orderBy(stockCategoriesTable.name);
  res.json(cats);
});

router.post("/stock-categories", authMiddleware, async (req, res) => {
  const [cat] = await db.insert(stockCategoriesTable).values({
    name: req.body.name,
    parentId: req.body.parentId,
  }).returning();
  res.status(201).json(cat);
});

router.put("/stock-categories/:id", authMiddleware, async (req, res) => {
  const [cat] = await db.update(stockCategoriesTable).set({
    name: req.body.name,
    parentId: req.body.parentId,
  }).where(eq(stockCategoriesTable.id, Number(req.params.id))).returning();
  if (!cat) return res.status(404).json({ error: "Not found" });
  res.json(cat);
});

router.delete("/stock-categories/:id", authMiddleware, async (req, res) => {
  await db.delete(stockCategoriesTable).where(eq(stockCategoriesTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ---- ITEMS ----
router.get("/stock-items", authMiddleware, async (req, res) => {
  const { search, categoryId, lowStock } = req.query;
  const conditions: any[] = [eq(stockItemsTable.isDeleted, "false")];
  if (categoryId) conditions.push(eq(stockItemsTable.categoryId, Number(categoryId)));
  if (search) conditions.push(like(stockItemsTable.name, `%${search}%`));
  if (lowStock === "true") {
    conditions.push(sql`physical_stock::numeric <= min_stock_level::numeric`);
  }

  const items = await db.select().from(stockItemsTable)
    .where(and(...conditions))
    .orderBy(stockItemsTable.name);

  res.json(items.map(i => ({
    ...i,
    physicalStock: Number(i.physicalStock),
    minStockLevel: Number(i.minStockLevel),
    purchaseRate: Number(i.purchaseRate),
    saleRate: Number(i.saleRate),
  })));
});

router.post("/stock-items", authMiddleware, async (req, res) => {
  const d = req.body;
  const [item] = await db.insert(stockItemsTable).values({
    name: d.name,
    categoryId: d.categoryId,
    brand: d.brand,
    hsnCode: d.hsnCode,
    unit: d.unit || "pcs",
    purchaseRate: String(d.purchaseRate || 0),
    saleRate: String(d.saleRate || 0),
    minStockLevel: String(d.minStockLevel || 0),
    barcode: d.barcode,
    physicalStock: String(d.physicalStock || 0),
  }).returning();
  res.status(201).json({ ...item, physicalStock: Number(item.physicalStock) });
});

router.get("/stock-items/:id", authMiddleware, async (req, res) => {
  const [item] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, Number(req.params.id))).limit(1);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ ...item, physicalStock: Number(item.physicalStock), saleRate: Number(item.saleRate), purchaseRate: Number(item.purchaseRate) });
});

router.put("/stock-items/:id", authMiddleware, async (req, res) => {
  const d = req.body;
  const [item] = await db.update(stockItemsTable).set({
    name: d.name,
    categoryId: d.categoryId,
    brand: d.brand,
    hsnCode: d.hsnCode,
    unit: d.unit,
    purchaseRate: String(d.purchaseRate || 0),
    saleRate: String(d.saleRate || 0),
    minStockLevel: String(d.minStockLevel || 0),
    barcode: d.barcode,
  }).where(eq(stockItemsTable.id, Number(req.params.id))).returning();
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.delete("/stock-items/:id", authMiddleware, async (req, res) => {
  await db.update(stockItemsTable).set({ isDeleted: "true" }).where(eq(stockItemsTable.id, Number(req.params.id)));
  res.json({ ok: true });
});

router.post("/stock-items/:id/adjust", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { quantity, reason } = req.body;

  const [item] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, Number(id))).limit(1);
  if (!item) return res.status(404).json({ error: "Not found" });

  const newStock = Number(item.physicalStock) + Number(quantity);
  await db.update(stockItemsTable).set({ physicalStock: String(newStock) }).where(eq(stockItemsTable.id, Number(id)));

  await db.insert(stockTransactionsTable).values({
    itemId: Number(id),
    type: quantity >= 0 ? "adjustment_in" : "adjustment_out",
    quantity: String(Math.abs(quantity)),
    balanceAfter: String(newStock),
    reason,
  });

  res.json({ ok: true, newStock });
});

router.get("/stock-items/:id/transactions", authMiddleware, async (req, res) => {
  const txs = await db.select().from(stockTransactionsTable)
    .where(eq(stockTransactionsTable.itemId, Number(req.params.id)))
    .orderBy(sql`created_at DESC`);
  res.json(txs.map(t => ({ ...t, quantity: Number(t.quantity), balanceAfter: Number(t.balanceAfter) })));
});

export default router;
