const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  const invRes = await pool.query(`SELECT invoice_number, is_kaccha, subtotal, grand_total, date FROM sale_invoices WHERE invoice_number = 'Sana00012'`);
  console.log(invRes.rows);
  const items = await pool.query(`SELECT * FROM sale_invoice_items WHERE invoice_id = $1`, [invRes.rows[0].id]);
  console.log('Items length:', items.rows.length);
  pool.end();
}
run().catch(console.error);
