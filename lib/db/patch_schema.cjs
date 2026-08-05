const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  
  try {
    const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'business_%'");
    for (const row of schemasRes.rows) {
      const schema = row.schema_name;
      console.log('Patching schema:', schema);
      
      try {
        await client.query(`ALTER TABLE ${schema}.company_settings ADD COLUMN auto_round_off BOOLEAN NOT NULL DEFAULT false;`);
        console.log(`Added auto_round_off to ${schema}.company_settings`);
      } catch (e) {
        if (e.code === '42701') {
          console.log(`Column auto_round_off already exists in ${schema}.company_settings`);
        } else {
          console.error(`Error altering ${schema}.company_settings:`, e.message);
        }
      }
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
