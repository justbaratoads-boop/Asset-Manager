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

// Check if THIS specific batch is directly referenced in any bill line item
async function isBatchDirectlyUsedInBills(batchId: number): Promise<boolean> {
  const result = await db.execute<{ cnt: string }>(sql`
    SELECT (
      (SELECT COUNT(*) FROM sale_invoice_items     WHERE batch_id = ${batchId}) +
      (SELECT COUNT(*) FROM purchase_invoice_items WHERE batch_id = ${batchId}) +
      (SELECT COUNT(*) FROM order_items            WHERE batch_id = ${batchId}) +
      (SELECT COUNT(*) FROM purchase_order_items   WHERE batch_id = ${batchId})
    ) AS cnt
  `);
  return Number(result.rows[0].cnt) > 0;
}

// ---- BATCHES ----
router.get("/stock-batches", authMiddleware, async (req, res) => {
  const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
  const [batches, items, usedResult] = await Promise.all([
    db.select().from(stockBatchesTable)
      .where(itemId ? eq(stockBatchesTable.stockItemId, itemId) : undefined)
      .orderBy(stockBatchesTable.name),
    db.select({ id: stockItemsTable.id, name: stockItemsTable.name })
      .from(stockItemsTable).where(eq(stockItemsTable.isDeleted, "false")),
    db.execute<{ batch_id: number }>(sql`
      SELECT DISTINCT batch_id FROM sale_invoice_items     WHERE batch_id IS NOT NULL
      UNION
      SELECT DISTINCT batch_id FROM purchase_invoice_items WHERE batch_id IS NOT NULL
      UNION
      SELECT DISTINCT batch_id FROM order_items            WHERE batch_id IS NOT NULL
      UNION
      SELECT DISTINCT batch_id FROM purchase_order_items   WHERE batch_id IS NOT NULL
    `),
  ]);

  const usedBatchIds = new Set(usedResult.rows.map(r => Number(r.batch_id)));

  const result = batches.map(b => ({
    ...b,
    openingStock: Number(b.openingStock),
    physicalStock: Number(b.physicalStock),
    reservedStock: Number(b.reservedStock),
    availableStock: Number(b.physicalStock) - Number(b.reservedStock),
    usedInBills: usedBatchIds.has(b.id),
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

  const [existing] = await db.select({
    openingStock: stockBatchesTable.openingStock,
    physicalStock: stockBatchesTable.physicalStock,
    stockItemId: stockBatchesTable.stockItemId,
  }).from(stockBatchesTable).where(eq(stockBatchesTable.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const directlyUsed = await isBatchDirectlyUsedInBills(id);
  const incomingItemId: number | null = Array.isArray(itemIds) && itemIds.length > 0 ? Number(itemIds[0]) : null;

  // If used in bills, block stock item reassignment but allow all other edits
  if (directlyUsed && incomingItemId !== existing.stockItemId) {
    return res.status(400).json({
      error: "This batch is used in bills and cannot be reassigned to a different stock item.",
      code: "BATCH_REASSIGN_LOCKED",
    });
  }

  const itemId = directlyUsed ? existing.stockItemId : incomingItemId;
  const newOpening = openingStock !== undefined ? Number(openingStock) : Number(existing.openingStock || 0);
  const delta = newOpening - Number(existing.openingStock || 0);
  const newPhysical = Number(existing.physicalStock || 0) + delta;

  const [batch] = await db.update(stockBatchesTable).set({
    name, description, expiryDate,
    openingStock: String(newOpening),
    physicalStock: String(newPhysical),
    stockItemId: itemId,
  }).where(eq(stockBatchesTable.id, id)).returning();
  if (!batch) return res.status(404).json({ error: "Not found" });

  // If old item had this as default batch and item changed, clear old item's default
  const oldItemId = existing.stockItemId;
  if (oldItemId && oldItemId !== itemId) {
    const [oldItem] = await db.select({ batchId: stockItemsTable.batchId })
      .from(stockItemsTable).where(eq(stockItemsTable.id, oldItemId)).limit(1);
    if (oldItem?.batchId === id) {
      const [anotherBatch] = await db.select({ id: stockBatchesTable.id })
        .from(stockBatchesTable)
        .where(and(eq(stockBatchesTable.stockItemId, oldItemId), sql`${stockBatchesTable.id} != ${id}`))
        .limit(1);
      await db.update(stockItemsTable)
        .set({ batchId: anotherBatch?.id ?? null })
        .where(eq(stockItemsTable.id, oldItemId));
    }
  }
  if (itemId) {
    const [newItem] = await db.select({ batchId: stockItemsTable.batchId })
      .from(stockItemsTable).where(eq(stockItemsTable.id, itemId)).limit(1);
    if (!newItem?.batchId) {
      await db.update(stockItemsTable).set({ batchId: id }).where(eq(stockItemsTable.id, itemId));
    }
  }

  res.json({ ...batch, usedInBills: directlyUsed });
});

router.delete("/stock-batches/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  if (await isBatchDirectlyUsedInBills(id)) {
    return res.status(400).json({ error: "Cannot delete: this batch is referenced in one or more bills" });
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
router.get("/stock-items", async (req, res) => {
  const { search, categoryId, lowStock } = req.query;
  const conditions: any[] = [eq(stockItemsTable.isDeleted, "false")];
  if (categoryId) conditions.push(eq(stockItemsTable.categoryId, Number(categoryId)));
  if (search) conditions.push(ilike(stockItemsTable.name, `%${search}%`));

  const items = await db.select({
    item: stockItemsTable,
    batchStock: sql<string>`COALESCE(SUM(${stockBatchesTable.physicalStock}::numeric), 0)`,
  })
    .from(stockItemsTable)
    .leftJoin(stockBatchesTable, eq(stockBatchesTable.stockItemId, stockItemsTable.id))
    .where(and(...conditions))
    .groupBy(stockItemsTable.id)
    .orderBy(stockItemsTable.name);

  let result = items.map(({ item: i, batchStock }) => {
    const unbatched = Number(i.physicalStock);
    const batched = Number(batchStock);
    return {
      ...i,
      unbatchedStock: unbatched,
      physicalStock: unbatched + batched,
      minStockLevel: Number(i.minStockLevel),
      purchaseRate: Number(i.purchaseRate),
      saleRate: Number(i.saleRate),
    };
  });

  if (lowStock === "true") {
    result = result.filter(i => i.physicalStock <= i.minStockLevel);
  }

  res.json(result);
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
    physicalStock: String(Number(d.physicalStock) || 0),
    gstApplicable: d.gstApplicable === true || d.gstApplicable === "true" ? "true" : "false",
    gstRate: String(d.gstRate || 0),
    isDecimalApplicable: d.isDecimalApplicable !== undefined ? (d.isDecimalApplicable === true || d.isDecimalApplicable === "true") : true,
    decimalPlaces: d.decimalPlaces !== undefined ? Number(d.decimalPlaces) : 2,
    isTaxLiability: d.isTaxLiability === "false" || d.isTaxLiability === false ? false : true,
  }).returning();
  res.status(201).json({ ...item, physicalStock: Number(item.physicalStock) });
});

router.get("/stock-items/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const [item] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, id)).limit(1);
  if (!item) return res.status(404).json({ error: "Not found" });
  const usedInBills = await isItemUsedInBills(id);
  const [batchSum] = await db.select({
    total: sql<string>`COALESCE(SUM(physical_stock::numeric), 0)`,
  }).from(stockBatchesTable).where(eq(stockBatchesTable.stockItemId, id));
  const unbatched = Number(item.physicalStock);
  const batched = Number(batchSum?.total ?? 0);
  res.json({
    ...item,
    unbatchedStock: unbatched,
    physicalStock: unbatched + batched,
    saleRate: Number(item.saleRate),
    purchaseRate: Number(item.purchaseRate),
    usedInBills,
  });
});

router.get("/stock-items/:id/gst-affected-bills", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const from = (req.query.from as string) || "";
  if (!from) return res.json({ saleCount: 0, purchaseCount: 0 });

  const [saleResult, purchaseResult] = await Promise.all([
    db.execute<{ cnt: string }>(sql`
      SELECT COUNT(DISTINCT sii.invoice_id)::text AS cnt
      FROM sale_invoice_items sii
      JOIN sale_invoices si ON si.id = sii.invoice_id
      WHERE sii.stock_item_id = ${id}
        AND si.date >= ${from}
        AND si.is_deleted = 'false'
    `),
    db.execute<{ cnt: string }>(sql`
      SELECT COUNT(DISTINCT pii.invoice_id)::text AS cnt
      FROM purchase_invoice_items pii
      JOIN purchase_invoices pi ON pi.id = pii.invoice_id
      WHERE pii.stock_item_id = ${id}
        AND pi.date >= ${from}
        AND pi.is_deleted = 'false'
    `),
  ]);

  res.json({
    saleCount: Number(saleResult.rows[0]?.cnt ?? 0),
    purchaseCount: Number(purchaseResult.rows[0]?.cnt ?? 0),
  });
});

router.put("/stock-items/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const d = req.body;
  const used = await isItemUsedInBills(id);

  const [current] = await db.select().from(stockItemsTable).where(eq(stockItemsTable.id, id)).limit(1);
  if (!current) return res.status(404).json({ error: "Not found" });

  const newGstRate = String(d.gstRate || 0);
  const gstChanged = Number(newGstRate) !== Number(current.gstRate);
  const effectiveFrom: string | undefined = d.gstEffectiveFrom;

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
    physicalStock: d.physicalStock !== undefined ? String(Number(d.physicalStock) || 0) : current.physicalStock,
    gstApplicable: d.gstApplicable === true || d.gstApplicable === "true" ? "true" : "false",
    gstRate: newGstRate,
    isDecimalApplicable: d.isDecimalApplicable !== undefined ? (d.isDecimalApplicable === true || d.isDecimalApplicable === "true") : current.isDecimalApplicable,
    decimalPlaces: d.decimalPlaces !== undefined ? Number(d.decimalPlaces) : current.decimalPlaces,
    isTaxLiability: d.isTaxLiability !== undefined ? (d.isTaxLiability === "false" || d.isTaxLiability === false ? false : true) : current.isTaxLiability,
  }).where(eq(stockItemsTable.id, id)).returning();

  if (gstChanged) {
    await db.insert(stockItemGstHistoryTable).values({
      itemId: id,
      oldRate: String(Number(current.gstRate)),
      newRate: newGstRate,
      effectiveFrom: effectiveFrom ?? null,
    });
  }

  let retroUpdate: { saleCount: number; purchaseCount: number } | undefined;

  if (gstChanged && effectiveFrom) {
    const rate = Number(newGstRate);

    // Retroactively update sale invoice line items
    await db.execute(sql`
      UPDATE sale_invoice_items sii
      SET
        gst_pct    = ${rate},
        cgst       = CASE WHEN si.is_interstate THEN 0
                          ELSE ROUND(sii.taxable_amount * ${rate} / 200, 2) END,
        sgst       = CASE WHEN si.is_interstate THEN 0
                          ELSE ROUND(sii.taxable_amount * ${rate} / 200, 2) END,
        igst       = CASE WHEN si.is_interstate THEN ROUND(sii.taxable_amount * ${rate} / 100, 2)
                          ELSE 0 END,
        total      = ROUND(sii.taxable_amount * (1 + ${rate} / 100.0), 2)
      FROM sale_invoices si
      WHERE sii.invoice_id = si.id
        AND sii.stock_item_id = ${id}
        AND si.date >= ${effectiveFrom}
        AND si.is_deleted = 'false'
    `);

    // Recalculate sale invoice header totals for affected invoices
    const saleUpdated = await db.execute<{ cnt: string }>(sql`
      WITH affected AS (
        SELECT DISTINCT sii.invoice_id
        FROM sale_invoice_items sii
        JOIN sale_invoices si ON si.id = sii.invoice_id
        WHERE sii.stock_item_id = ${id}
          AND si.date >= ${effectiveFrom}
          AND si.is_deleted = 'false'
      ),
      agg AS (
        SELECT sii.invoice_id,
          COALESCE(SUM(sii.cgst), 0)  AS tc,
          COALESCE(SUM(sii.sgst), 0)  AS ts,
          COALESCE(SUM(sii.igst), 0)  AS ti
        FROM sale_invoice_items sii
        WHERE sii.invoice_id IN (SELECT invoice_id FROM affected)
        GROUP BY sii.invoice_id
      )
      UPDATE sale_invoices si
      SET
        total_cgst  = agg.tc,
        total_sgst  = agg.ts,
        total_igst  = agg.ti,
        total_gst   = agg.tc + agg.ts + agg.ti,
        grand_total = si.grand_total - si.total_gst + (agg.tc + agg.ts + agg.ti),
        balance_due = si.balance_due - si.total_gst + (agg.tc + agg.ts + agg.ti)
      FROM agg
      WHERE si.id = agg.invoice_id
      RETURNING si.id
    `);

    // Retroactively update purchase invoice line items
    await db.execute(sql`
      UPDATE purchase_invoice_items pii
      SET
        gst_pct    = ${rate},
        cgst       = CASE WHEN pi.is_interstate THEN 0
                          ELSE ROUND(pii.taxable_amount * ${rate} / 200, 2) END,
        sgst       = CASE WHEN pi.is_interstate THEN 0
                          ELSE ROUND(pii.taxable_amount * ${rate} / 200, 2) END,
        igst       = CASE WHEN pi.is_interstate THEN ROUND(pii.taxable_amount * ${rate} / 100, 2)
                          ELSE 0 END,
        total      = ROUND(pii.taxable_amount * (1 + ${rate} / 100.0), 2)
      FROM purchase_invoices pi
      WHERE pii.invoice_id = pi.id
        AND pii.stock_item_id = ${id}
        AND pi.date >= ${effectiveFrom}
        AND pi.is_deleted = 'false'
    `);

    // Recalculate purchase invoice header totals
    const purchaseUpdated = await db.execute<{ cnt: string }>(sql`
      WITH affected AS (
        SELECT DISTINCT pii.invoice_id
        FROM purchase_invoice_items pii
        JOIN purchase_invoices pi ON pi.id = pii.invoice_id
        WHERE pii.stock_item_id = ${id}
          AND pi.date >= ${effectiveFrom}
          AND pi.is_deleted = 'false'
      ),
      agg AS (
        SELECT pii.invoice_id,
          COALESCE(SUM(pii.cgst), 0)  AS tc,
          COALESCE(SUM(pii.sgst), 0)  AS ts,
          COALESCE(SUM(pii.igst), 0)  AS ti
        FROM purchase_invoice_items pii
        WHERE pii.invoice_id IN (SELECT invoice_id FROM affected)
        GROUP BY pii.invoice_id
      )
      UPDATE purchase_invoices pi
      SET
        total_cgst  = agg.tc,
        total_sgst  = agg.ts,
        total_igst  = agg.ti,
        grand_total = pi.grand_total - pi.total_cgst - pi.total_sgst - pi.total_igst + (agg.tc + agg.ts + agg.ti),
        balance_due = pi.balance_due - pi.total_cgst - pi.total_sgst - pi.total_igst + (agg.tc + agg.ts + agg.ti)
      FROM agg
      WHERE pi.id = agg.invoice_id
      RETURNING pi.id
    `);

    retroUpdate = {
      saleCount: saleUpdated.rows.length,
      purchaseCount: purchaseUpdated.rows.length,
    };
  }

  res.json({ ...item, usedInBills: used, ...(retroUpdate ? { retroUpdate } : {}) });
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



