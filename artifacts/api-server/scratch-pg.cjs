const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(() => {
  return client.query("SELECT * FROM ledgers WHERE name = 'Round Off'");
}).then(res => {
  console.log(res.rows);
  process.exit();
}).catch(console.error);
