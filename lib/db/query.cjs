const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(() => client.query('SELECT id, name, is_deleted, is_decimal_applicable, decimal_places FROM stock_items limit 5')).then((res) => { console.log(res.rows); process.exit(0) }).catch(console.error);
