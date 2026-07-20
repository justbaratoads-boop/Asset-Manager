const { db } = require('./lib/db/dist/index.cjs');
const { sql } = require('drizzle-orm');

async function run() {
  await db.execute(sql`UPDATE sale_invoices SET grand_total = balance_due WHERE is_kaccha = false AND balance_due < grand_total AND amount_paid = 0`);
  console.log('Fixed invoices!');
  process.exit(0);
}

run().catch(console.error);
