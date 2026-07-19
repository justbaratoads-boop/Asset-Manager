const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'purchase_invoices';").then(res => { console.log(res.rows); process.exit(0); });
