const { db } = require('./artifacts/api-server/node_modules/@workspace/db/dist/index.js');
const schema = require('./artifacts/api-server/node_modules/@workspace/db/dist/schema/index.js');
const { eq } = require('drizzle-orm');

async function run() {
  const r = await db.select().from(schema.saleInvoicesTable).where(eq(schema.saleInvoicesTable.invoiceNumber, 'Est14'));
  console.log(r);
  process.exit();
}
run();
