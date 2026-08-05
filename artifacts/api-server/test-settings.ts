import { db } from '@workspace/db';
import { companySettingsTable } from '@workspace/db';

async function run() {
  const settings = await db.select().from(companySettingsTable);
  console.log(settings);
  process.exit(0);
}
run();
