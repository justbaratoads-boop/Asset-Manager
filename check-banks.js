const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" });

async function run() {
  const res = await pool.query(`SELECT id, name, "group" FROM ledgers`);
  console.log(res.rows);
  process.exit(0);
}
run();
