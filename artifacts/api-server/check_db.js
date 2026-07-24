import "dotenv/config";
import { db } from "./src/db/index.js";
import { saleInvoicesTable, saleInvoiceItemsTable } from "./src/db/schema.js";
import { desc, eq } from "drizzle-orm";

async function run() {
  const invs = await db.select().from(saleInvoicesTable).orderBy(desc(saleInvoicesTable.id)).limit(2);
  for (const inv of invs) {
    const items = await db.select().from(saleInvoiceItemsTable).where(eq(saleInvoiceItemsTable.invoiceId, inv.id));
    console.log(JSON.stringify({ inv, items }, null, 2));
  }
  process.exit(0);
}
run();
