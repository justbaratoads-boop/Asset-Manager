const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(() => client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'auto_round_off'")).then(res => console.log(res.rows)).catch(console.error).finally(() => client.end());
