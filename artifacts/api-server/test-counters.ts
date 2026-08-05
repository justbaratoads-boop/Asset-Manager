import { db } from '@workspace/db';
import { countersTable } from '@workspace/db';

async function run() {
  const counters = await db.select().from(countersTable);
  console.log(counters);
  process.exit(0);
}
run();
