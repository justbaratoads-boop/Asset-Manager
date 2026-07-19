const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
pool.query("SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'purchase_invoice_items' AND column_name = 'unit';").then(res => { console.log(res.rows); process.exit(0); });
