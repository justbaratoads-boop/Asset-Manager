import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    const res = await pool.query("SELECT * FROM business_1.sale_invoice_items WHERE invoice_id = 99");
    console.log('Invoice 99 (Sana00057) items:', res.rows);
    
    const invRes = await pool.query("SELECT id, invoice_number FROM business_1.sale_invoices WHERE invoice_number ILIKE '%SANA00067%' OR invoice_number ILIKE '%SANA0067%'");
    console.log('SANA67 search:', invRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
