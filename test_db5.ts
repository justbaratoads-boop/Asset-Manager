import { db } from './lib/db/src/index';
import { companySettingsTable } from './lib/db/src/schema/company';

async function run() {
  try {
    const settings = await db.select().from(companySettingsTable).limit(1);
    console.log("Settings:");
    console.dir(settings, { depth: null });
  } catch (err) {
    console.error("ERROR SELECTING SETTINGS:", err);
  }
  process.exit(0);
}

run().catch(console.error);
