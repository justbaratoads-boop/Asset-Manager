const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const invoicesTables = ['sale_invoices', 'purchase_invoices', 'credit_notes', 'debit_notes'];
  const itemsTables = ['sale_invoice_items', 'purchase_invoice_items', 'credit_note_items', 'debit_note_items'];

  for (const table of invoicesTables) {
    try {
      await client.query(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS total_discount numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS total_taxable numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS total_cgst numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS total_sgst numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS total_igst numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS total_gst numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS is_kaccha BOOLEAN NOT NULL DEFAULT FALSE;
      `);
      console.log(`Updated ${table}`);
    } catch (e) {
      console.log(`Failed to update ${table}: ${e.message}`);
    }
  }

  for (const table of itemsTables) {
    try {
      await client.query(`
        ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS discount_pct numeric(5, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS gst_pct numeric(5, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS taxable_amount numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS cgst numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS sgst numeric(15, 2) NOT NULL DEFAULT '0',
        ADD COLUMN IF NOT EXISTS igst numeric(15, 2) NOT NULL DEFAULT '0';
      `);
      console.log(`Updated ${table}`);
    } catch (e) {
      console.log(`Failed to update ${table}: ${e.message}`);
    }
  }

  // Also check stock_transactions just in case
  try {
    await client.query(`ALTER TABLE stock_transactions ADD COLUMN IF NOT EXISTS is_kaccha BOOLEAN NOT NULL DEFAULT FALSE;`);
  } catch(e) {}

  await client.end();
}

run().catch(console.error);
