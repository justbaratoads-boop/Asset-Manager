import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  const users = await db.execute(sql`SELECT * FROM users`);
  console.log("Users:", users);
  process.exit(0);
}
run();
