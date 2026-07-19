const { Pool } = require('pg'); 
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' }); 
async function run() { 
  try { 
    await pool.query("ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS is_kaccha BOOLEAN NOT NULL DEFAULT false"); 
    console.log('Added is_kaccha to stock_transactions successfully!'); 
  } catch(err) { 
    console.error(err); 
  } 
  process.exit(0); 
} 
run();
