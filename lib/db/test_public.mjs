import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const res = await pool.query("SELECT id, name FROM public.stock_items WHERE name ILIKE '%hero%'");
    console.log('Public stock items:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
