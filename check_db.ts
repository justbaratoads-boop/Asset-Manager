import { baseDb } from "./lib/db/src/index.ts";
import { sql } from "drizzle-orm";
async function run() {
  try {
    const res = await baseDb.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'stock_transactions' AND column_name = 'is_kaccha';
    `);
    console.log(res);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
