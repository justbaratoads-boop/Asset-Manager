const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/accountancy' });
async function run() {
  await pool.query(`UPDATE sale_invoices SET grand_total = balance_due WHERE is_kaccha = false AND balance_due < grand_total AND amount_paid = 0`);
  console.log('Fixed invoices!');
  pool.end();
}
run().catch(console.error);
