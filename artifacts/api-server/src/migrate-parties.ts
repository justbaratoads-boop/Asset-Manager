import { db } from "@workspace/db";
import { ledgersTable, partiesTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";

async function main() {
  const ledgers = await db.select().from(ledgersTable).where(
    inArray(ledgersTable.group, ["Sundry Debtors", "Sundry Creditors"])
  );
  
  console.log(`Found ${ledgers.length} ledgers in Debtors/Creditors groups.`);
  
  for (const l of ledgers) {
    const type = l.group === "Sundry Debtors" ? "customer" : "supplier";
    console.log(`Migrating ${l.name} to parties...`);
    await db.insert(partiesTable).values({
      name: l.name,
      type: type,
      accountGroup: l.group,
      openingBalance: l.openingBalance,
      balanceType: l.nature,
    });
    
    // Delete from ledgers table
    await db.delete(ledgersTable).where(inArray(ledgersTable.id, [l.id]));
  }
  
  console.log("Migration complete!");
}

main().catch(console.error);
