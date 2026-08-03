const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: "-c search_path=business_1,public"
  });

  const res = await pool.query("SHOW search_path;");
  console.log("Search path:", res.rows[0].search_path);
  await pool.end();
}

run().catch(console.error);
