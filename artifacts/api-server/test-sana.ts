import { db } from '@workspace/db';
import { saleInvoicesTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

async function run() {
  const invs = await db.select().from(saleInvoicesTable).where(eq(saleInvoicesTable.invoiceNumber, 'Sana00068'));
  console.log(invs);
  process.exit(0);
}
run();
