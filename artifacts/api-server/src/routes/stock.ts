import { Router } from "express";
import { db } from "@workspace/db";
import { stockCategoriesTable, stockItemsTable, stockTransactionsTable, stockBatchesTable } from "@workspace/db/schema";
import { eq, and, like, sql, ilike } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

// Check if a stock item is used in any bill (sale invoice, purchase invoice, order, purchase order, credit note, debit note)
async function isItemUsedInBills(itemId: number): Promise<boolean> {
  const result = await db.execute<{ cnt: string }>(sql`
    SELECT (
      (SELECT COUNT(*) FROM sale_invoice_items WHERE stock_item_id = ${itemId}) +
      (SELECT COUNT(*) FROM purchase_invoice_items WHERE stock_item_id = ${itemId}) +
      (SELECT COUNT(*) FROM order_items WHERE stock_item_id = ${itemId}) +
      (SELECT COUNT(*) FROM purchase_order_items WHERE stock_item_id = ${itemId}) +
      (SELECT COUNT(*) FROM credit_note_items WHERE stock_item_id = ${itemId}) +
      (SELECT COUNT(*) FROM debit_note_items WHERE stock_item_id = ${itemId})
    ) AS cnt
  `);
  return Number(result.rows[0].cnt) > 0;
}

// Check if any item assigned to a batch is used in bills
async function isBatchUsedInBills(batchId: number): Promise<boolean> {
  const batchItems = await db.select({ id: stockItemsTable.id })
    .from(stockItemsTable)
    .where(eq(stockItemsTable.batchId, batchId));
  for (const item of batchItems) {
    if (await isItemUsedInBills(item.id)) return true;
  }
  return false;
}

// ---- BATCHES ----
router.get("/stock-batches", authMiddleware, async (_req, res) => {
  const batches = await db.select().from(stockBatchesTable).orderBy(stockBatchesTable.name);
  const items = await db.select({
    id: stockItemsTable.id,
    name: stockItemsTable.name,
    batchId: stockItemsTable.batchId,
  }).from(stockItemsTable).where(eq(stockItemsTable.isDeleted, "false"));

  const result = batches.map(b => ({
    ...b,
    items: items.filter(i => i.batchId === b.id).map(i => ({ id: i.id, name: i.name })),
  }));
  res.json(result);
});

router.post("/stock-batches", authMiddleware, async (req, res) => {
  const { name, description, expiryDate, itemIds } = req.body;
  // Duplicate name check
  const [existing] = await db.select({ id: stockBatchesTable.id })
    .from(stockBatchesTable)
    .where(ilike(stockBatchesTable.name, name.trim()))
    .limit(1);
  if (existing) {
    return res.status(400).json({ error: `A batch named "${name.trim()}" already exists` });
  }
  const [batch] = await db.insert(stockBatchesTable).values({ name, description, expiryDate }).returning();
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    for (const itemId of itemIds) {
      await db.update(stockItemsTable).set({ batchId: batch.id }).where(eq(stockItemsTable.id, Number(itemId)));
    }
  }
  res.status(201).json(batch);
});

router.put("/stock-batches/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, expiryDate, itemIds } = req.body;
  // Block edit if any assigned item is used in a bill
  if (await isBatchUsedInBills(id)) {
    return res.status(400).json({ error: "Cannot edit: one or more items in this batch are used in bills" });
  }
  const [batch] = await db.update(stockBatchesTable).set({ name, description, expiryDate })
    .where(eq(stockBatchesTable.id, id)).returning();
  if (!batch) return res.status(404).json({ error: "Not found" });
  await db.update(stockItemsTable).set({ batchId: null }).where(eq(stockItemsTable.batchId, id));
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    for (const itemId of itemIds) {
      await db.update(stockItemsTable).set({ batchId: id }).where(eq(stockItemsTable.id, Number(itemId)));
    }
  }
  res.json(batch);
});

router.delete("/stock-batches/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  // Block delete if any assigned item is used in a bill
  if (await isBatchUsedInBills(id)) {
    return res.status(400).json({ error: "Cannot delete: one or more items in this batch are used in bills" });
  }
  await db.update(stockItemsTable).set({ batchId: null }).where(eq(stockItemsTable.batchId, id));
  await db.delete(stockBatchesTable).where(eq(stockBatchesTable.id, id));
  res.json({ ok: true });
});

// ---- CATEGORIES ----
router.get("/stock-categories", authMiddleware, async (_req, res) => {
  const cats = await db.select({
    id: stockCategoriesTable.id,
    name: stockCategoriesTable.name,
    parentId: stockCategoriesTable.parentId,
    createdAt: stockCategoriesTable.createdAt,
    updatedAt: stockCategoriesTable.updatedAt,
    itemCount: sql<number>`count(${stockItemsTable.id})::int`,
  })
    .from(stockCategoriesTable)
    .leftJoin(stockItemsTable, eq(stockItemsTable.categoryId, stockCategoriesTable.id))
    .groupBy(stockCategoriesTable.id)
    .orderBy(stockCategoriesTable.name);
  res.json(cats);
});

router.post("/stock-categories", authMiddleware, async (req, res) => {
  const name = req.body.name?.trim();
  // Duplicate name check (case-insensitive)
  const [existing] = await db.select({ id: stockCategoriesTable.id })
    .from(stockCategoriesTable)
    .where(ilike(stockCategoriesTable.name, name))
    .limit(1);
  if (existing) {
    return res.status(400).json({ error: `A category named "${name}" already exists` });
  }
  const [cat] = await db.insert(stockCategoriesTable).values({
    name,
    parentId: req.body.parentId,
  }).returning();
  res.status(201).json(cat);
});

router.put("/stock-categories/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(stockItemsTable)
    .where(eq(stockItemsTable.categoryId, id));
  if (count > 0) {
    return res.status(400).json({
      error: `Cannot rename: ${count} item${count !== 1 ? "s are" : " is"} assigned to this category`,
    });
  }
  const [cat] = await db.update(stockCategoriesTable).set({
    name: req.body.name,
    parentId: req.body.parentId,
  }).where(eq(stockCategoriesTable.id, id)).returning();
  if (!cat) return res.status(404).json({ error: "Not found" });
  res.json(cat);
});

router.delete("/stock-categories/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(stockItemsTable)
    .where(eq(stockItemsTable.categoryId, id));
  if (count > 0) {
    return res.status(400).json({
      error: `Cannot delete: ${count} item${count !== 1 ? "s are" : " is"} assigned to this category`,
    });
  }
  await db.delete(stockCategoriesTable).where(eq(stockCategoriesTable.id, id));
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
  const name = d.name?.trim();
  // Duplicate name check (case-insensitive, among non-deleted items)
  const [existing] = await db.select({ id: stockItemsTable.id })
    .from(stockItemsTable)
    .where(and(ilike(stockItemsTable.name, name), eq(stockItemsTable.isDeleted, "false")))
    .limit(1);
  if (existing) {
    return res.status(400).json({ error: `A stock item named "${name}" already exists` });
  }
  const [item] = await db.insert(stockItemsTable).values({
    name,
    categoryId: d.categoryId,
    batchId: d.batchId ? Number(d.batchId) : null,
    hsnCode: d.hsnCode,
    unit: d.unit || "pcs",
    purchaseRate: String(d.purchaseRate || 0),
    saleRate: String(d.saleRate || 0),
    minStockLevel: String(d.minStockLevel || 0),
    barcode: d.barcode,
    physicalStock: String(d.physicalStock || 0),
    gstApplicable: d.gstApplicable === true || d.gstApplicable === "true" ? "true" : "false",
    gstRate: String(d.gstRate || 0),
  }).returning();
  res.status(201).json({ ...item, physicalStock: Number(item.physicalStock) });
});

router.get("/stock-items/:id", authMiddleware, async (req, res) => {
  const [item] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, Number(req.params.id))).limit(1);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ ...item, physicalStock: Number(item.physicalStock), saleRate: Number(item.saleRate), purchaseRate: Number(item.purchaseRate) });
});

router.put("/stock-items/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  // Block edit if item is used in any bill
  if (await isItemUsedInBills(id)) {
    return res.status(400).json({ error: "Cannot edit: this item is used in one or more bills" });
  }
  const d = req.body;
  const [item] = await db.update(stockItemsTable).set({
    name: d.name,
    categoryId: d.categoryId,
    batchId: d.batchId ? Number(d.batchId) : null,
    hsnCode: d.hsnCode,
    unit: d.unit,
    purchaseRate: String(d.purchaseRate || 0),
    saleRate: String(d.saleRate || 0),
    minStockLevel: String(d.minStockLevel || 0),
    barcode: d.barcode,
    gstApplicable: d.gstApplicable === true || d.gstApplicable === "true" ? "true" : "false",
    gstRate: String(d.gstRate || 0),
  }).where(eq(stockItemsTable.id, id)).returning();
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.delete("/stock-items/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  // Block delete if item is used in any bill
  if (await isItemUsedInBills(id)) {
    return res.status(400).json({ error: "Cannot delete: this item is used in one or more bills" });
  }
  await db.update(stockItemsTable).set({ isDeleted: "true" }).where(eq(stockItemsTable.id, id));
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
