import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const res1 = await pool.query("SELECT * FROM public.parties");
    console.log('Public parties:', res1.rows);
    const res2 = await pool.query("SELECT * FROM public.ledgers");
    console.log('Public ledgers:', res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
