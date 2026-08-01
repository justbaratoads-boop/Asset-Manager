import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const res = await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'business_%'");
    let found = false;
    for (const row of res.rows) {
      const schema = row.nspname;
      const itemsRes = await pool.query(`SELECT id, name FROM ${schema}.stock_items WHERE name ILIKE '%hero%'`);
      if (itemsRes.rows.length > 0) {
        console.log('Found in schema:', schema, itemsRes.rows);
        found = true;
      }
      
      const invRes = await pool.query(`SELECT id, invoice_number FROM ${schema}.sale_invoices WHERE invoice_number ILIKE '%SANA0006%' OR invoice_number ILIKE '%SANA006%'`);
      if (invRes.rows.length > 0) {
        console.log('Found SANA0060 in schema:', schema, invRes.rows);
        found = true;
      }
    }
    if (!found) console.log('NO HERO ITEMS OR SANA0060 INVOICES FOUND IN ANY BUSINESS.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
