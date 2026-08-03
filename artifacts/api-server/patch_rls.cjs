const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  
  try {
    const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'business_%'");
    for (const row of schemasRes.rows) {
      const schema = row.schema_name;
      console.log('Patching schema:', schema);
      
      const kacchaTables = ['journal_entries', 'payments', 'receipts', 'sale_invoices', 'orders', 'purchase_invoices', 'purchase_orders', 'stock_batches'];
      
      for (const table of kacchaTables) {
        await client.query(`ALTER TABLE ${schema}.${table} ENABLE ROW LEVEL SECURITY;`);
        await client.query(`ALTER TABLE ${schema}.${table} FORCE ROW LEVEL SECURITY;`);
        await client.query(`DROP POLICY IF EXISTS hide_kaccha ON ${schema}.${table};`);
        await client.query(`
          CREATE POLICY hide_kaccha ON ${schema}.${table} FOR SELECT USING (
            is_kaccha = false OR 
            COALESCE((SELECT enable_dual_ledger FROM ${schema}.company_settings LIMIT 1), 'false') = 'true'
          );
        `);
      }
      
      // For stock_items
      await client.query(`ALTER TABLE ${schema}.stock_items ENABLE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE ${schema}.stock_items FORCE ROW LEVEL SECURITY;`);
      await client.query(`DROP POLICY IF EXISTS hide_kaccha ON ${schema}.stock_items;`);
      await client.query(`
        CREATE POLICY hide_kaccha ON ${schema}.stock_items FOR SELECT USING (
          is_tax_liability = true OR 
          COALESCE((SELECT enable_dual_ledger FROM ${schema}.company_settings LIMIT 1), 'false') = 'true'
        );
      `);
    }
    console.log('Done');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
