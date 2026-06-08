import { db } from "@workspace/db";
import { partiesTable, ledgersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function run() {
  const parties = await db.select().from(partiesTable);
  console.log("Parties count:", parties.length);
  for (const p of parties) {
    console.log(`Party: ${p.name}, type: ${p.type}, group: ${p.accountGroup}, isDeleted: ${p.isDeleted}`);
  }

  const ledgers = await db.select().from(ledgersTable);
  console.log("Ledgers count:", ledgers.length);
  for (const l of ledgers) {
    console.log(`Ledger: ${l.name}, group: ${l.group}, isDeleted: ${l.isDeleted}`);
  }

  process.exit(0);
}
run();
