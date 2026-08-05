import { db } from '@workspace/db';
import { saleInvoicesTable } from '@workspace/db';
import { desc } from 'drizzle-orm';

async function run() {
  try {
    const invoices = await db.select().from(saleInvoicesTable).orderBy(desc(saleInvoicesTable.id)).limit(10);
    console.log(JSON.stringify(invoices, null, 2));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
