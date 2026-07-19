const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    await pool.query("ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS gst_calculation_method text NOT NULL DEFAULT 'none'");
    console.log('Added gst_calculation_method column');
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
