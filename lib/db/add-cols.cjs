const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
});
async function run() {
  await client.connect();
  try { await client.query('ALTER TABLE ledgers ADD COLUMN is_gst_applicable boolean DEFAULT false NOT NULL;'); } catch(e) {}
  try { await client.query('ALTER TABLE ledgers ADD COLUMN gst_rate numeric(5,2);'); } catch(e) {}
  try { await client.query('ALTER TABLE ledgers ADD COLUMN hsn_sac text;'); } catch(e) {}
  console.log('Columns added');
  await client.end();
}
run().catch(console.error);
