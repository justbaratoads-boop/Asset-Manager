const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });

async function run() {
  await client.connect();
  const schemasRes = await client.query(`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
      AND schema_name NOT LIKE 'pg_%'
  `);
  
  const schemas = schemasRes.rows.map(r => r.schema_name);
  console.log('Found schemas:', schemas);

  const tablesToMigrate = ['credit_note_items', 'debit_note_items'];

  for (const schema of schemas) {
    for (const table of tablesToMigrate) {
      const tableCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      `, [schema, table]);
      
      if (tableCheck.rows.length === 0) continue;

      try {
        await client.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS batch_id INTEGER`);
        console.log(`  [${schema}] ✅ Added batch_id to ${table}`);
      } catch(e) {
        console.error(`  [${schema}] ❌ ${table} error:`, e.message);
      }
    }
  }
  console.log('✅ Migration complete!');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
