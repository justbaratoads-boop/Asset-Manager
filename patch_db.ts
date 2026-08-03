import { baseDb } from "./lib/db/src/index.ts";
import { sql } from "drizzle-orm";
async function run() {
  try {
    await baseDb.execute(sql`ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS is_kaccha BOOLEAN NOT NULL DEFAULT FALSE;`);
    console.log("Added is_kaccha to stock_transactions");
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
