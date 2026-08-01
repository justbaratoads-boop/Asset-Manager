import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    console.log('Migrating Hero Honda and Activa (ids 48, 49)');
    await pool.query("INSERT INTO business_1.stock_items SELECT * FROM public.stock_items WHERE id >= 48 ON CONFLICT DO NOTHING");
    await pool.query("DELETE FROM public.stock_items WHERE id >= 48");
    
    console.log('Migrating parties (ids 53, 54)');
    await pool.query("INSERT INTO business_1.parties SELECT * FROM public.parties WHERE id >= 53 ON CONFLICT DO NOTHING");
    await pool.query("DELETE FROM public.parties WHERE id >= 53");
    
    console.log('Migrated successfully.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
