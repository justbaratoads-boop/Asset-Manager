import { db } from "./lib/db/src/index.ts";
import { saleInvoicesTable } from "./lib/db/src/schema/invoices.ts";
async function run() {
  try {
    const inv = await db.insert(saleInvoicesTable).values({
      invoiceNumber: "TEST01",
      date: "2026-08-02",
      partyName: "Test",
      subtotal: "0",
      grandTotal: "0",
      amountPaid: "0",
      balanceDue: "0"
    }).returning();
    console.log(inv);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
