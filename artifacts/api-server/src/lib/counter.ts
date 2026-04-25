import { db } from "@workspace/db";
import { countersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export async function nextCounter(name: string): Promise<number> {
  const existing = await db
    .select()
    .from(countersTable)
    .where(eq(countersTable.name, name))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(countersTable).values({ name, value: 1 });
    return 1;
  }

  const next = existing[0].value + 1;
  await db
    .update(countersTable)
    .set({ value: next })
    .where(eq(countersTable.name, name));
  return next;
}

export async function makeInvoiceNumber(prefix: string): Promise<string> {
  const n = await nextCounter(`invoice_${prefix}`);
  return `${prefix}${String(n).padStart(5, "0")}`;
}

export async function makeVoucherNumber(type: string): Promise<string> {
  const n = await nextCounter(`voucher_${type}`);
  return `${type.toUpperCase()}${String(n).padStart(5, "0")}`;
}
