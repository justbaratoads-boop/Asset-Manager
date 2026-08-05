import { db } from './lib/db/src/index';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    const schemasRes = await db.execute(sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'business_%'`);
    for (const row of schemasRes.rows) {
      const schema = row.schema_name as string;
      console.log('Patching schema:', schema);
      
      try {
        await db.execute(sql.raw(`ALTER TABLE ${schema}.company_settings ADD COLUMN auto_round_off BOOLEAN NOT NULL DEFAULT false;`));
        console.log(`Added auto_round_off to ${schema}.company_settings`);
      } catch (e: any) {
        if (e.code === '42701') {
          console.log(`Column auto_round_off already exists in ${schema}.company_settings`);
        } else {
          console.error(`Error altering ${schema}.company_settings:`, e.message);
        }
      }
    }
    console.log('Done');
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
