import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

async function patchDb() {
  try {
    await db.execute(sql`ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS auto_round_off BOOLEAN NOT NULL DEFAULT false`);
    console.log("Patched auto_round_off in company_settings");
  } catch (err) {
    console.error(err);
  }
}

patchDb();
