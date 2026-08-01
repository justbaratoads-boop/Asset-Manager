import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.gkezrzbxcsgpguqsfhkq:Starlord_098@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres' });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get all public invoices
    const invoicesRes = await client.query('SELECT * FROM public.sale_invoices');
    const publicInvoices = invoicesRes.rows;
    console.log(`Found ${publicInvoices.length} invoices in public schema.`);
    
    // Get all public invoice items
    const itemsRes = await client.query('SELECT * FROM public.sale_invoice_items');
    const publicItems = itemsRes.rows;
    console.log(`Found ${publicItems.length} invoice items in public schema.`);

    // Get all public invoice payments
    const paymentsRes = await client.query('SELECT * FROM public.sale_invoice_payments');
    const publicPayments = paymentsRes.rows;
    console.log(`Found ${publicPayments.length} invoice payments in public schema.`);

    // Set search path to business_1
    await client.query('SET search_path TO business_1, public');
    
    let invoicesMigrated = 0;
    let itemsMigrated = 0;
    let paymentsMigrated = 0;

    for (const inv of publicInvoices) {
      // Check if invoice_number already exists in business_1
      const existing = await client.query('SELECT id FROM sale_invoices WHERE invoice_number = $1', [inv.invoice_number]);
      if (existing.rows.length > 0) {
        console.log(`Invoice ${inv.invoice_number} already exists in business_1, skipping.`);
        continue;
      }

      // Insert invoice
      const invCols = Object.keys(inv).filter(k => k !== 'id');
      const invVals = invCols.map(k => inv[k]);
      
      const insertQuery = `
        INSERT INTO sale_invoices (${invCols.map(c => `"${c}"`).join(', ')})
        VALUES (${invCols.map((_, i) => `$${i + 1}`).join(', ')})
        RETURNING id
      `;
      const insertedInv = await client.query(insertQuery, invVals);
      const newInvId = insertedInv.rows[0].id;
      invoicesMigrated++;

      // Insert items for this invoice
      const invItems = publicItems.filter(item => item.invoice_id === inv.id);
      for (const item of invItems) {
        const itemCols = Object.keys(item).filter(k => k !== 'id');
        // Replace invoice_id with newInvId
        item.invoice_id = newInvId;
        const itemVals = itemCols.map(k => item[k]);
        
        const insertItemQuery = `
          INSERT INTO sale_invoice_items (${itemCols.map(c => `"${c}"`).join(', ')})
          VALUES (${itemCols.map((_, i) => `$${i + 1}`).join(', ')})
        `;
        await client.query(insertItemQuery, itemVals);
        itemsMigrated++;
      }

      // Insert payments for this invoice
      const invPayments = publicPayments.filter(payment => payment.invoice_id === inv.id);
      for (const payment of invPayments) {
        const paymentCols = Object.keys(payment).filter(k => k !== 'id');
        // Replace invoice_id with newInvId
        payment.invoice_id = newInvId;
        const paymentVals = paymentCols.map(k => payment[k]);
        
        const insertPaymentQuery = `
          INSERT INTO sale_invoice_payments (${paymentCols.map(c => `"${c}"`).join(', ')})
          VALUES (${paymentCols.map((_, i) => `$${i + 1}`).join(', ')})
        `;
        await client.query(insertPaymentQuery, paymentVals);
        paymentsMigrated++;
      }
    }

    console.log(`Migrated ${invoicesMigrated} invoices, ${itemsMigrated} items, ${paymentsMigrated} payments.`);
    
    await client.query('COMMIT');
    console.log('Migration successful.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
