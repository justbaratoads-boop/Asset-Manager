import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const schemasRes = await db.execute(sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'business_%'`);
    for (const row of schemasRes.rows) {
      const schema = row.schema_name as string;
      console.log('Patching schema:', schema);
      
      const kacchaTables = ['journal_entries', 'payments', 'receipts', 'sale_invoices', 'orders', 'purchase_invoices', 'purchase_orders', 'stock_batches'];
      
      for (const table of kacchaTables) {
        try {
          await db.execute(sql.raw(`ALTER TABLE ${schema}.${table} ENABLE ROW LEVEL SECURITY;`));
          await db.execute(sql.raw(`ALTER TABLE ${schema}.${table} FORCE ROW LEVEL SECURITY;`));
          await db.execute(sql.raw(`DROP POLICY IF EXISTS hide_kaccha ON ${schema}.${table};`));
          await db.execute(sql.raw(`
            CREATE POLICY hide_kaccha ON ${schema}.${table} FOR SELECT USING (
              is_kaccha = false OR 
              COALESCE((SELECT enable_dual_ledger FROM ${schema}.company_settings LIMIT 1), 'false') = 'true'
            );
          `));
        } catch (e: any) {
          console.log(`Skipping ${schema}.${table}: ${e.message}`);
        }
      }
      
      // For stock_items
      try {
        await db.execute(sql.raw(`ALTER TABLE ${schema}.stock_items ENABLE ROW LEVEL SECURITY;`));
        await db.execute(sql.raw(`ALTER TABLE ${schema}.stock_items FORCE ROW LEVEL SECURITY;`));
        await db.execute(sql.raw(`DROP POLICY IF EXISTS hide_kaccha ON ${schema}.stock_items;`));
        await db.execute(sql.raw(`
          CREATE POLICY hide_kaccha ON ${schema}.stock_items FOR SELECT USING (
            is_tax_liability = true OR 
            COALESCE((SELECT enable_dual_ledger FROM ${schema}.company_settings LIMIT 1), 'false') = 'true'
          );
        `));
      } catch (e: any) {
        console.log(`Skipping ${schema}.stock_items: ${e.message}`);
      }
    }
    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
