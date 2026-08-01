import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const bus1 = await pool.query("SELECT MAX(id) FROM business_1.sale_invoices");
    console.log('Max ID in bus1:', bus1.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
