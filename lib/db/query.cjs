const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  const invRes = await pool.query(`SELECT id FROM sale_invoices WHERE invoice_number = 'Sana00012'`);
  if (invRes.rows.length === 0) { console.log('not found'); return; }
  const invId = invRes.rows[0].id;
  const items = await pool.query(`SELECT * FROM sale_invoice_items WHERE invoice_id = $1`, [invId]);
  console.log(items.rows);
  pool.end();
}
run().catch(console.error);
