import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const pub = await pool.query("SELECT id, invoice_number FROM public.sale_invoices ORDER BY id");
    const bus1 = await pool.query("SELECT id, invoice_number FROM business_1.sale_invoices ORDER BY id");
    console.log(`Public has ${pub.rows.length}, Business 1 has ${bus1.rows.length}`);
    
    // Check overlaps
    const bus1Ids = new Set(bus1.rows.map(r => r.id));
    let overlaps = 0;
    for (const r of pub.rows) {
      if (bus1Ids.has(r.id)) overlaps++;
    }
    console.log(`Overlaps: ${overlaps}`);
    
    // Find missing in business_1
    const missing = pub.rows.filter(r => !bus1Ids.has(r.id));
    console.log('Missing in business_1:', missing);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
