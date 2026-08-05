import { db } from '@workspace/db';
import { saleInvoicesTable } from '@workspace/db';

async function run() {
  try {
    await db.insert(saleInvoicesTable).values({
      invoiceNumber: "TEST-NAN-1",
      date: "2026-08-04",
      partyName: "Test",
      isGst: true,
      isInterstate: false,
      isKaccha: false,
      subtotal: "NaN", // Testing this!
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
    });
    console.log("Success");
  } catch (e) {
    console.error("Failed:", e);
  }
  process.exit(0);
}
run();
