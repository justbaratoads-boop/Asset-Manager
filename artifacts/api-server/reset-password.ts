import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function run() {
  const hash = await bcrypt.hash("123456", 10);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.email, "admin@example.com"));
  console.log("Password updated successfully.");
  process.exit(0);
}
run();
