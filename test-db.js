import { Pool } from "pg";

const pool = new Pool({
  connectionString: "postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
});

async function run() {
  const res = await pool.query("SELECT id, name, account_group, is_deleted FROM parties");
  console.log("Parties:", res.rows);
  const lRes = await pool.query("SELECT id, name, \"group\", is_deleted FROM ledgers");
  console.log("Ledgers:", lRes.rows);
  process.exit(0);
}
run();
