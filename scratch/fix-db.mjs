import { db } from './artifacts/api-server/node_modules/@workspace/db/dist/index.js';
import * as schema from './artifacts/api-server/node_modules/@workspace/db/dist/schema/index.js';
import { eq } from 'drizzle-orm';

async function fixInvoices() {
  const invoices = await db.select().from(schema.saleInvoicesTable).where(eq(schema.saleInvoicesTable.isKaccha, true));
  
  for (const inv of invoices) {
    if (Number(inv.grandTotal) === 0) {
      console.log(`Fixing invoice ${inv.invoiceNumber} (ID: ${inv.id})`);
      const items = await db.select().from(schema.saleInvoiceItemsTable).where(eq(schema.saleInvoiceItemsTable.invoiceId, inv.id));
      
      const newGrandTotal = items.reduce((s, i) => s + Number(i.total || 0), 0);
      let newBalanceDue = newGrandTotal - Number(inv.amountPaid || 0);
      let newStatus = Number(inv.amountPaid) >= newGrandTotal ? "paid" : (Number(inv.amountPaid) > 0 ? "partial" : "confirmed");
      
      if (newGrandTotal > 0) {
        await db.update(schema.saleInvoicesTable)
          .set({ 
            grandTotal: String(newGrandTotal), 
            balanceDue: String(newBalanceDue),
            status: newStatus
          })
          .where(eq(schema.saleInvoicesTable.id, inv.id));
        console.log(`Updated ${inv.invoiceNumber}: grandTotal = ${newGrandTotal}, balanceDue = ${newBalanceDue}`);
      }
    }
  }
  
  console.log("Done checking sale invoices.");
  process.exit(0);
}

fixInvoices().catch(e => { console.error(e); process.exit(1); });
