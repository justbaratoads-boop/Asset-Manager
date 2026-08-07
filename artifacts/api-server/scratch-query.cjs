const { db } = require('@workspace/db');
const schema = require('@workspace/db/schema');
const { eq } = require('drizzle-orm');

async function run() {
  try {
    const r = await db.select().from(schema.saleInvoicesTable).where(eq(schema.saleInvoicesTable.invoiceNumber, 'Est14'));
    console.log(r);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
run();
