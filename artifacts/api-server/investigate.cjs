const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/accountancy' });
async function run() {
  const invRes = await pool.query(`SELECT id FROM sale_invoices WHERE invoice_number = 'Sana00012'`);
  if (invRes.rows.length === 0) { console.log('not found'); return; }
  const invId = invRes.rows[0].id;
  const items = await pool.query(`SELECT item_name, rate, quantity, taxable_amount, total FROM sale_invoice_items WHERE invoice_id = $1`, [invId]);
  console.log(items.rows);
  pool.end();
}
run().catch(console.error);
