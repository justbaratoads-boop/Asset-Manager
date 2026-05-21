import { db } from "@workspace/db";
import { stockBatchesTable, stockItemsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/**
 * Adjust physical stock for a transaction.
 * - If batchId is provided: update ONLY the batch's physicalStock (batch-aware stock)
 * - If batchId is null/undefined: update ONLY the item's physicalStock (unbatched stock)
 *
 * This enforces the invariant:
 *   Total stock = item.physicalStock (unbatched) + SUM(batch.physicalStock for item)
 *
 * Returns the new physicalStock balance for whichever pool was updated.
 */
export async function adjustStock(
  itemId: number,
  batchId: number | null | undefined,
  delta: number,
): Promise<number> {
  if (delta === 0) return 0;
  if (batchId) {
    const [b] = await db.select({ ps: stockBatchesTable.physicalStock })
      .from(stockBatchesTable).where(eq(stockBatchesTable.id, batchId)).limit(1);
    const newPs = Math.max(0, Number(b?.ps || 0) + delta);
    await db.update(stockBatchesTable)
      .set({ physicalStock: String(newPs) })
      .where(eq(stockBatchesTable.id, batchId));
    return newPs;
  } else {
    const [item] = await db.select({ ps: stockItemsTable.physicalStock })
      .from(stockItemsTable).where(eq(stockItemsTable.id, itemId)).limit(1);
    const newPs = Math.max(0, Number(item?.ps || 0) + delta);
    await db.update(stockItemsTable)
      .set({ physicalStock: String(newPs) })
      .where(eq(stockItemsTable.id, itemId));
    return newPs;
  }
}

/**
 * Adjust reserved stock for a sale order.
 * Only supported for batched items — unbatched items don't carry a reserved counter.
 * reservedDelta: positive = reserve (order placed), negative = unreserve (order cancelled/fulfilled)
 */
export async function adjustReservedStock(
  batchId: number | null | undefined,
  reservedDelta: number,
): Promise<void> {
  if (reservedDelta === 0 || !batchId) return;
  const [b] = await db.select({ rs: stockBatchesTable.reservedStock })
    .from(stockBatchesTable).where(eq(stockBatchesTable.id, batchId)).limit(1);
  const newRs = Math.max(0, Number(b?.rs || 0) + reservedDelta);
  await db.update(stockBatchesTable)
    .set({ reservedStock: String(newRs) })
    .where(eq(stockBatchesTable.id, batchId));
}

/**
 * Directly adjust a batch's stock counters by its ID.
 * Kept for backwards-compatibility with stock.ts route (batch opening stock edits).
 */
export async function adjustBatchStock(
  batchId: number,
  physicalDelta: number,
  reservedDelta: number,
): Promise<void> {
  if (physicalDelta === 0 && reservedDelta === 0) return;
  const [b] = await db.select({ ps: stockBatchesTable.physicalStock, rs: stockBatchesTable.reservedStock })
    .from(stockBatchesTable).where(eq(stockBatchesTable.id, batchId)).limit(1);
  const updates: Partial<typeof stockBatchesTable.$inferInsert> = {};
  if (physicalDelta !== 0) updates.physicalStock = String(Math.max(0, Number(b?.ps || 0) + physicalDelta));
  if (reservedDelta !== 0) updates.reservedStock = String(Math.max(0, Number(b?.rs || 0) + reservedDelta));
  if (Object.keys(updates).length > 0) {
    await db.update(stockBatchesTable).set(updates).where(eq(stockBatchesTable.id, batchId));
  }
}
