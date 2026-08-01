const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' });
async function run() {
  const res = await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'business_%'");
  for (const row of res.rows) {
    const schema = row.nspname;
    const invRes = await pool.query(`SELECT * FROM ${schema}.sale_invoices WHERE invoice_number LIKE '%SANA%'`);
    if (invRes.rows.length > 0) {
      console.log('Found in schema:', schema, 'Count:', invRes.rows.length);
    }
  }
  process.exit(0);
}
run();
