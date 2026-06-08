import { db } from "@workspace/db";
import { partiesTable, ledgersTable } from "@workspace/db/schema";

async function run() {
  const parties = await db.select().from(partiesTable);
  console.log("Parties:", parties.map(p => ({ name: p.name, accountGroup: p.accountGroup, isDeleted: p.isDeleted })));
  
  const ledgers = await db.select().from(ledgersTable);
  console.log("Ledgers:", ledgers.map(l => ({ name: l.name, group: l.group, isDeleted: l.isDeleted })));
  
  process.exit(0);
}
run();
