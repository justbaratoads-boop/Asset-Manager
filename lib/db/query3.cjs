const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  const invRes = await pool.query(`SELECT id FROM sale_invoices WHERE invoice_number = 'Sana00012'`);
  if (invRes.rows.length === 0) return;
  const invId = invRes.rows[0].id;
  const p = await pool.query(`SELECT * FROM sale_invoice_payments WHERE invoice_id = $1`, [invId]);
  console.log('Payments:', p.rows.length);
  const s = await pool.query(`SELECT * FROM stock_transactions WHERE reference = 'Sana00012'`);
  console.log('Stock transactions:', s.rows.length);
  pool.end();
}
run().catch(console.error);
