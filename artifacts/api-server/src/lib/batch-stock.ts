import { db } from "@workspace/db";
import { stockItemsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Directly adjust a batch's stock counters by its ID.
 */
export async function adjustBatchStock(
  batchId: number,
  physicalDelta: number,
  reservedDelta: number,
): Promise<void> {
  if (physicalDelta === 0 && reservedDelta === 0) return;
  await db.execute(sql`
    UPDATE stock_batches SET
      physical_stock = GREATEST(0, physical_stock + ${physicalDelta}),
      reserved_stock = GREATEST(0, reserved_stock + ${reservedDelta})
    WHERE id = ${batchId}
  `);
}

/**
 * Adjust batch stock counters for a stock item.
 * If explicitBatchId is provided, uses that batch directly.
 * Otherwise looks up the item's default batchId.
 * physicalDelta: positive = increase (purchase/credit note), negative = decrease (sale invoice/debit note)
 * reservedDelta: positive = increase (order placed), negative = decrease (order cancelled/fulfilled)
 */
export async function adjustBatchStockForItem(
  stockItemId: number,
  physicalDelta: number,
  reservedDelta: number,
  explicitBatchId?: number | null,
): Promise<void> {
  if (physicalDelta === 0 && reservedDelta === 0) return;
  let batchId: number | null | undefined = explicitBatchId;
  if (!batchId) {
    const [item] = await db
      .select({ batchId: stockItemsTable.batchId })
      .from(stockItemsTable)
      .where(eq(stockItemsTable.id, stockItemId))
      .limit(1);
    batchId = item?.batchId;
  }
  if (!batchId) return;
  await adjustBatchStock(batchId, physicalDelta, reservedDelta);
}
