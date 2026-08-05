import { db } from './lib/db/src/index';
import { sql } from 'drizzle-orm';

async function run() {
  const res = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'company_settings'`);
  console.log(res.rows.map(r => r.column_name));
  process.exit(0);
}

run().catch(console.error);
