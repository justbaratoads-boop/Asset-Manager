import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
async function run() {
  await db.execute(sql`ALTER TABLE company_settings ADD COLUMN auto_round_off BOOLEAN NOT NULL DEFAULT false;`);
  console.log("Done");
  process.exit(0);
}
run();
