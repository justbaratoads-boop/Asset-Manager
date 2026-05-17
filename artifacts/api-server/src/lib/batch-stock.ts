import { db } from "@workspace/db";
import { stockBatchesTable } from "@workspace/db/schema";
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
 * Otherwise finds the first batch assigned to the item via stockBatchesTable.stockItemId.
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
    const [batch] = await db
      .select({ id: stockBatchesTable.id })
      .from(stockBatchesTable)
      .where(eq(stockBatchesTable.stockItemId, stockItemId))
      .limit(1);
    batchId = batch?.id;
  }
  if (!batchId) return;
  await adjustBatchStock(batchId, physicalDelta, reservedDelta);
}
