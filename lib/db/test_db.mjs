import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const res = await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'business_%'");
    for (const row of res.rows) {
      const schema = row.nspname;
      const itemsRes = await pool.query(`SELECT id, name, is_deleted, created_at FROM ${schema}.stock_items ORDER BY created_at DESC LIMIT 10`);
      console.log(`\n--- Schema: ${schema} - Latest Items ---`);
      console.log(itemsRes.rows);
      
      const invsRes = await pool.query(`SELECT invoice_number, created_at FROM ${schema}.sale_invoices ORDER BY created_at DESC LIMIT 10`);
      console.log(`\n--- Schema: ${schema} - Latest Invoices ---`);
      console.log(invsRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
