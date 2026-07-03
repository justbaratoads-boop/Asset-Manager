import { db } from '@workspace/db';
import { companySettingsTable } from '@workspace/db/schema';
async function main() {
  try {
    const settings = await db.select().from(companySettingsTable).limit(1);
    console.log(settings);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
main();
