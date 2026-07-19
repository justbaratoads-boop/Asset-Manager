import { Client } from 'pg';

const client = new Client({
  connectionString: "postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
});

async function run() {
  await client.connect();
  
  const tables = ["orders", "purchase_orders", "sale_invoices", "purchase_invoices"];
  
  for (const table of tables) {
    try {
      await client.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "is_kaccha" boolean DEFAULT false NOT NULL`);
      console.log(`Added is_kaccha to ${table}`);
    } catch(e) { 
      console.error(`Failed on ${table}:`, e.message);
    }
  }

  await client.end();
}

run();
