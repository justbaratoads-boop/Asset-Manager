import { Router } from "express";
import { db } from "@workspace/db";
import { stockCategoriesTable, stockItemsTable, stockTransactionsTable, stockBatchesTable, stockItemGstHistoryTable } from "@workspace/db/schema";
import { eq, and, sql, ilike } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router = Router();

// Check if a stock item is used in any bill
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

// Check if a batch's assigned item is used in bills
async function isBatchUsedInBills(batchId: number): Promise<boolean> {
  const [batch] = await db.select({ stockItemId: stockBatchesTable.stockItemId })
    .from(stockBatchesTable).where(eq(stockBatchesTable.id, batchId)).limit(1);
  if (!batch?.stockItemId) return false;
  return isItemUsedInBills(batch.stockItemId);
}

// ---- BATCHES ----
router.get("/stock-batches", authMiddleware, async (_req, res) => {
  const batches = await db.select().from(stockBatchesTable).orderBy(stockBatchesTable.name);
  const items = await db.select({
    id: stockItemsTable.id,
    name: stockItemsTable.name,
  }).from(stockItemsTable).where(eq(stockItemsTable.isDeleted, "false"));

  const result = batches.map(b => ({
    ...b,
    openingStock: Number(b.openingStock),
    physicalStock: Number(b.physicalStock),
    reservedStock: Number(b.reservedStock),
    availableStock: Number(b.physicalStock) - Number(b.reservedStock),
    items: b.stockItemId ? items.filter(i => i.id === b.stockItemId).map(i => ({ id: i.id, name: i.name })) : [],
  }));
  res.json(result);
});

router.post("/stock-batches", authMiddleware, async (req, res) => {
  const { name, description, expiryDate, itemIds, openingStock } = req.body;
  const [existing] = await db.select({ id: stockBatchesTable.id })
    .from(stockBatchesTable)
    .where(ilike(stockBatchesTable.name, name.trim()))
    .limit(1);
  if (existing) {
    return res.status(400).json({ error: `A batch named "${name.trim()}" already exists` });
  }
  const itemId: number | null = Array.isArray(itemIds) && itemIds.length > 0 ? Number(itemIds[0]) : null;
  const opening = String(Number(openingStock) || 0);
  const [batch] = await db.insert(stockBatchesTable).values({
    name: name.trim(), description, expiryDate,
    openingStock: opening, physicalStock: opening,
    stockItemId: itemId,
  }).returning();
  // Set item's default batch if item has no batch assigned yet
  if (itemId) {
    const [item] = await db.select({ batchId: stockItemsTable.batchId })
      .from(stockItemsTable).where(eq(stockItemsTable.id, itemId)).limit(1);
    if (!item?.batchId) {
      await db.update(stockItemsTable).set({ batchId: batch.id }).where(eq(stockItemsTable.id, itemId));
    }
  }
  res.status(201).json(batch);
});

router.put("/stock-batches/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, expiryDate, itemIds, openingStock } = req.body;
  if (await isBatchUsedInBills(id)) {
    return res.status(400).json({ error: "Cannot edit: the item assigned to this batch is used in bills" });
  }
  const itemId: number | null = Array.isArray(itemIds) && itemIds.length > 0 ? Number(itemIds[0]) : null;

  // Adjust physical stock by the opening stock delta if opening changed
  const [existing] = await db.select({
    openingStock: stockBatchesTable.openingStock,
    physicalStock: stockBatchesTable.physicalStock,
    stockItemId: stockBatchesTable.stockItemId,
  }).from(stockBatchesTable).where(eq(stockBatchesTable.id, id)).limit(1);

  const newOpening = openingStock !== undefined ? Number(openingStock) : Number(existing?.openingStock || 0);
  const delta = newOpening - Number(existing?.openingStock || 0);
  const newPhysical = Math.max(0, Number(existing?.physicalStock || 0) + delta);

  const [batch] = await db.update(stockBatchesTable).set({
    name, description, expiryDate,
    openingStock: String(newOpening),
    physicalStock: String(newPhysical),
    stockItemId: itemId,
  }).where(eq(stockBatchesTable.id, id)).returning();
  if (!batch) return res.status(404).json({ error: "Not found" });

  // If old item had this as default batch and item changed, clear old item's default
  const oldItemId = existing?.stockItemId;
  if (oldItemId && oldItemId !== itemId) {
    const [oldItem] = await db.select({ batchId: stockItemsTable.batchId })
      .from(stockItemsTable).where(eq(stockItemsTable.id, oldItemId)).limit(1);
    if (oldItem?.batchId === id) {
      // Find another batch for this item to use as default, or null
      const [anotherBatch] = await db.select({ id: stockBatchesTable.id })
        .from(stockBatchesTable)
        .where(and(eq(stockBatchesTable.stockItemId, oldItemId), sql`${stockBatchesTable.id} != ${id}`))
        .limit(1);
      await db.update(stockItemsTable)
        .set({ batchId: anotherBatch?.id ?? null })
        .where(eq(stockItemsTable.id, oldItemId));
    }
  }
  // Set new item's default batch if it has none
  if (itemId) {
    const [newItem] = await db.select({ batchId: stockItemsTable.batchId })
      .from(stockItemsTable).where(eq(stockItemsTable.id, itemId)).limit(1);
    if (!newItem?.batchId) {
      await db.update(stockItemsTable).set({ batchId: id }).where(eq(stockItemsTable.id, itemId));
    }
  }

  res.json(batch);
});

router.delete("/stock-batches/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (await isBatchUsedInBills(id)) {
    return res.status(400).json({ error: "Cannot delete: the item assigned to this batch is used in bills" });
  }
  const [batch] = await db.select({ stockItemId: stockBatchesTable.stockItemId })
    .from(stockBatchesTable).where(eq(stockBatchesTable.id, id)).limit(1);

  // If the item used this batch as its default, reassign to another batch or null
  if (batch?.stockItemId) {
    const [item] = await db.select({ batchId: stockItemsTable.batchId })
      .from(stockItemsTable).where(eq(stockItemsTable.id, batch.stockItemId)).limit(1);
    if (item?.batchId === id) {
      const [anotherBatch] = await db.select({ id: stockBatchesTable.id })
        .from(stockBatchesTable)
        .where(and(eq(stockBatchesTable.stockItemId, batch.stockItemId), sql`${stockBatchesTable.id} != ${id}`))
        .limit(1);
      await db.update(stockItemsTable)
        .set({ batchId: anotherBatch?.id ?? null })
        .where(eq(stockItemsTable.id, batch.stockItemId));
    }
  }
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
  if (search) conditions.push(ilike(stockItemsTable.name, `%${search}%`));
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
  const id = Number(req.params.id);
  const [item] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, id)).limit(1);
  if (!item) return res.status(404).json({ error: "Not found" });
  const usedInBills = await isItemUsedInBills(id);
  res.json({
    ...item,
    physicalStock: Number(item.physicalStock),
    saleRate: Number(item.saleRate),
    purchaseRate: Number(item.purchaseRate),
    usedInBills,
  });
});

router.put("/stock-items/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const d = req.body;
  const used = await isItemUsedInBills(id);

  // Fetch current item to detect GST rate change
  const [current] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, id)).limit(1);
  if (!current) return res.status(404).json({ error: "Not found" });

  const newGstRate = String(d.gstRate || 0);
  const gstChanged = Number(newGstRate) !== Number(current.gstRate);

  if (used) {
    // Only allow GST fields to be updated
    const [item] = await db.update(stockItemsTable).set({
      gstApplicable: d.gstApplicable === true || d.gstApplicable === "true" ? "true" : "false",
      gstRate: newGstRate,
    }).where(eq(stockItemsTable.id, id)).returning();

    // Log GST history if rate changed
    if (gstChanged) {
      await db.insert(stockItemGstHistoryTable).values({
        itemId: id,
        oldRate: String(Number(current.gstRate)),
        newRate: newGstRate,
      });
    }
    return res.json({ ...item, usedInBills: true });
  }

  // Full update for items not used in bills
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
    gstRate: newGstRate,
  }).where(eq(stockItemsTable.id, id)).returning();

  // Log GST history if rate changed
  if (gstChanged) {
    await db.insert(stockItemGstHistoryTable).values({
      itemId: id,
      oldRate: String(Number(current.gstRate)),
      newRate: newGstRate,
    });
  }

  res.json(item);
});

router.delete("/stock-items/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
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

// GST History for a stock item: change log + invoiced amounts per rate
router.get("/stock-items/:id/gst-history", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  // Change log
  const history = await db.select()
    .from(stockItemGstHistoryTable)
    .where(eq(stockItemGstHistoryTable.itemId, id))
    .orderBy(sql`changed_at DESC`);

  // Invoiced amounts per GST rate (sale + purchase invoices)
  const invoiced = await db.execute<{ gst_pct: string; source: string; total_amount: string; invoice_count: string }>(sql`
    SELECT gst_pct::text, 'sale' AS source,
           SUM(total)::text AS total_amount,
           COUNT(*)::text AS invoice_count
    FROM sale_invoice_items
    WHERE stock_item_id = ${id}
    GROUP BY gst_pct
    UNION ALL
    SELECT gst_pct::text, 'purchase' AS source,
           SUM(total)::text AS total_amount,
           COUNT(*)::text AS invoice_count
    FROM purchase_invoice_items
    WHERE stock_item_id = ${id}
    GROUP BY gst_pct
    ORDER BY gst_pct
  `);

  // Aggregate by gst rate across both sources
  const byRate: Record<string, { rate: number; saleAmount: number; purchaseAmount: number; saleCount: number; purchaseCount: number }> = {};
  for (const row of invoiced.rows) {
    const rate = String(Number(row.gst_pct));
    if (!byRate[rate]) byRate[rate] = { rate: Number(rate), saleAmount: 0, purchaseAmount: 0, saleCount: 0, purchaseCount: 0 };
    if (row.source === "sale") {
      byRate[rate].saleAmount = Number(row.total_amount);
      byRate[rate].saleCount = Number(row.invoice_count);
    } else {
      byRate[rate].purchaseAmount = Number(row.total_amount);
      byRate[rate].purchaseCount = Number(row.invoice_count);
    }
  }

  res.json({
    history: history.map(h => ({
      id: h.id,
      oldRate: Number(h.oldRate),
      newRate: Number(h.newRate),
      changedAt: h.changedAt,
    })),
    invoicedByRate: Object.values(byRate).sort((a, b) => a.rate - b.rate),
  });
});

export default router;
