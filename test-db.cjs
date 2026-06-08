const { Pool } = require("pg");
const pool = new Pool({ connectionString: "postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres" });

async function run() {
  const pRes = await pool.query("SELECT * FROM parties");
  console.log("Parties:", pRes.rows);
  process.exit(0);
}
run();
