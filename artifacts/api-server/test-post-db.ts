import { db } from '@workspace/db';
import { saleInvoicesTable, saleInvoiceItemsTable } from '@workspace/db';

async function run() {
  try {
    const item = {
      stockItemId: 0,
      itemName: "Test Item",
      hsnCode: "1234",
      quantity: "",
      unit: "pcs",
      rate: "",
      discountPct: "",
      gstPct: "",
      taxableAmount: "",
      cgst: "",
      sgst: "",
      igst: "",
      total: "",
      isTaxLiability: true
    };
    
    // Simulate what createInvoicePart does
    const invNum = "TEST-INV-2";
    
    const [inv] = await db.insert(saleInvoicesTable).values({
      invoiceNumber: invNum,
      date: "2026-08-04",
      partyId: null,
      partyName: "Test Party",
      isGst: true,
      isInterstate: false,
      isKaccha: false,
      subtotal: "0",
      totalDiscount: "0",
      totalTaxable: "0",
      totalCgst: "0",
      totalSgst: "0",
      totalIgst: "0",
      totalGst: "0",
      grandTotal: "0",
      amountPaid: "0",
      balanceDue: "0",
      status: "confirmed",
    }).returning();
    
    await db.insert(saleInvoiceItemsTable).values({
      invoiceId: inv.id,
      stockItemId: item.stockItemId, // What happens if we do this? Actually the previous code did NOT do this. It did `stockItemId: item.stockItemId`
      itemName: item.itemName,
      hsnCode: item.hsnCode,
      quantity: String(Number(item.quantity) || 0),
      unit: item.unit,
      rate: String(Number(item.rate) || 0),
      discountPct: String(Number(item.discountPct) || 0),
      gstPct: String(Number(item.gstPct) || 0),
      taxableAmount: String(Number(item.taxableAmount) || 0),
      cgst: String(Number(item.cgst) || 0),
      sgst: String(Number(item.sgst) || 0),
      igst: String(Number(item.igst) || 0),
      total: String(Number(item.total) || 0),
      batchId: null,
      description: null,
    });
    
    console.log("Success with stockItemId || null");
    
    // Clean up
    await db.delete(saleInvoiceItemsTable).where({ invoiceId: inv.id });
    await db.delete(saleInvoicesTable).where({ id: inv.id });
  } catch (e) {
    console.error("Failed:", e);
  }
  process.exit(0);
}
run();
