import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const res = await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'business_%'");
    for (const row of res.rows) {
      const schema = row.nspname;
      const itemsRes = await pool.query(`SELECT id, name FROM ${schema}.stock_items WHERE id = 48`);
      console.log(`Schema: ${schema} - Item 48:`, itemsRes.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
