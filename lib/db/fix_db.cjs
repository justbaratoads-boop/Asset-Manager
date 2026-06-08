const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
});
async function run() {
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE parties
      ADD COLUMN IF NOT EXISTS interest_enabled text NOT NULL DEFAULT 'false',
      ADD COLUMN IF NOT EXISTS interest_grace_period numeric NOT NULL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS interest_rate numeric(5,2),
      ADD COLUMN IF NOT EXISTS interest_by_transaction text NOT NULL DEFAULT 'false';
    `);
    console.log('Columns added successfully');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
