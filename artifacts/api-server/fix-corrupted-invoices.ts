import { db, sql } from '@workspace/db';
import { saleInvoicesTable, saleInvoiceItemsTable } from '@workspace/db';
import { eq, inArray } from 'drizzle-orm';

async function run() {
  const invoices = await db.select().from(saleInvoicesTable);
  
  for (const invoice of invoices) {
    if (invoice.isKaccha) continue;

    const items = await db.select().from(saleInvoiceItemsTable).where(eq(saleInvoiceItemsTable.invoiceId, invoice.id));
    
    const itemsTotal = items.reduce((s, i) => s + Number(i.total || 0), 0);
    
    let otherChargesParsed = 0;
    if (invoice.otherCharges) {
      try {
        const charges = JSON.parse(invoice.otherCharges);
        otherChargesParsed = charges.reduce((s: number, c: any) => s + ((c.type ?? "add") === "deduct" ? -Number(c.amount) : Number(c.amount)), 0);
      } catch (e) {}
    }
    
    const expectedGrandTotal = Number((itemsTotal + otherChargesParsed).toFixed(2));
    const currentGrandTotal = Number(invoice.grandTotal);
    
    if (Math.abs(expectedGrandTotal - currentGrandTotal) > 0.01) {
      console.log(`Fixing Invoice ${invoice.invoiceNumber}: Current Grand Total = ${currentGrandTotal}, Expected = ${expectedGrandTotal}`);
      
      const currentPaid = Number(invoice.amountPaid) || 0;
      const expectedBalance = expectedGrandTotal - currentPaid;
      
      await db.update(saleInvoicesTable).set({
        grandTotal: String(expectedGrandTotal),
        balanceDue: String(expectedBalance)
      }).where(eq(saleInvoicesTable.id, invoice.id));
    }
  }
  
  console.log("Done fixing invoices.");
  process.exit(0);
}

run();
