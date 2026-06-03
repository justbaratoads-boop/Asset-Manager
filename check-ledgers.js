const { db } = require('./artifacts/api-server/dist/db');
const { ledgersTable } = require('./lib/db/dist/schema');
const { eq, and } = require('drizzle-orm');

async function check() {
  const ledgers = await db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false"));
  console.log(ledgers.filter(l => l.isSystem === "true").map(l => ({ id: l.id, name: l.name })));
  process.exit(0);
}
check();
