const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
async function migrate() {
  await client.connect();
  const res = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'business_%' OR schema_name = 'public'`);
  const schemas = res.rows.map(r => r.schema_name);
  for (const schema of schemas) {
    try {
      console.log(`Migrating schema ${schema}...`);
      await client.query(`ALTER TABLE ${schema}.stock_items ADD COLUMN IF NOT EXISTS is_decimal_applicable boolean NOT NULL DEFAULT true`);
      await client.query(`ALTER TABLE ${schema}.stock_items ADD COLUMN IF NOT EXISTS decimal_places integer NOT NULL DEFAULT 2`);
    } catch (err) {
      console.error(`Failed to migrate ${schema}:`, err.message);
    }
  }
  console.log("Migration complete.");
  process.exit(0);
}
migrate().catch(console.error);
