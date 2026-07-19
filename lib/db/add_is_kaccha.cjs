const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });
pool.query(`
  ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS is_kaccha BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_kaccha BOOLEAN NOT NULL DEFAULT false;
`).then(res => { console.log('Successfully added columns'); process.exit(0); }).catch(console.error);
