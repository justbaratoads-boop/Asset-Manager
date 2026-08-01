import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function run() {
  try {
    // Check conflicts
    let conflict = false;
    
    // stock_items
    const stockPublic = await pool.query("SELECT id FROM public.stock_items");
    for (const r of stockPublic.rows) {
      const existing = await pool.query(`SELECT id FROM business_1.stock_items WHERE id = ${r.id}`);
      if (existing.rows.length > 0) { console.log('Conflict stock_items', r.id); conflict = true; }
    }
    
    // parties
    const partiesPublic = await pool.query("SELECT id FROM public.parties");
    for (const r of partiesPublic.rows) {
      const existing = await pool.query(`SELECT id FROM business_1.parties WHERE id = ${r.id}`);
      if (existing.rows.length > 0) { console.log('Conflict parties', r.id); conflict = true; }
    }
    
    if (!conflict) {
      console.log('No conflicts. Migrating...');
      await pool.query("INSERT INTO business_1.stock_items SELECT * FROM public.stock_items");
      await pool.query("DELETE FROM public.stock_items");
      
      // I'll leave ledgers alone, they might be system ledgers.
      // But parties... they created 53, 54 today.
      await pool.query("INSERT INTO business_1.parties SELECT * FROM public.parties WHERE id > 10");
      await pool.query("DELETE FROM public.parties WHERE id > 10");
      
      console.log('Migrated successfully.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
