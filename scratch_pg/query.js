const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
const query = process.argv[2];
client.connect().then(() => {
  return client.query(query);
}).then(res => {
  console.log('Rows:', res.rows);
  process.exit();
}).catch(console.error);
