import { db } from './node_modules/@workspace/db/dist/index.js';
import * as schema from './node_modules/@workspace/db/dist/schema/index.js';
import { eq } from 'drizzle-orm';

async function run() {
  const r = await db.select().from(schema.ledgersTable).where(eq(schema.ledgersTable.name, 'Round Off'));
  console.log(r);
  process.exit();
}
run();
