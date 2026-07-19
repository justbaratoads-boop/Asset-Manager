const { Pool } = require('pg'); 
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' }); 
async function run() { 
  try { 
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_transactions'"); 
    console.log(res.rows.map(r => r.column_name)); 
  } catch(err) { 
    console.error(err); 
  } 
  process.exit(0); 
} 
run();
