import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const res = await pool.query("SELECT invoice_number FROM business_1.sale_invoices ORDER BY id ASC");
    console.log(res.rows.map(r => r.invoice_number));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
