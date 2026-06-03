const fs = require('fs');
const path = require('path');

// 1. Fix invoice-form.tsx
const invFormPath = path.join(__dirname, 'artifacts/accounting-app/src/pages/sales/invoice-form.tsx');
let invForm = fs.readFileSync(invFormPath, 'utf8');

// Fix existing loading (line ~218)
invForm = invForm.replace(
  /if \(inv\.items\?\.length\) \{\s*setItems\(inv\.items\.map\(\(i: any\) => calcItem\(\{([\s\S]*?)gstInclusive:\s*false,\s*\}\), interstate\)\)\);\s*\}/g,
  `if (inv.items?.length) {
      setItems(inv.items.map((i: any) => {
        const qty = Number(i.quantity) || 0;
        const rate = Number(i.rate) || 0;
        const discPct = Number(i.discountPct) || 0;
        const grossAmount = (qty * rate) * (1 - discPct / 100);
        const taxable = Number(i.taxableAmount) || 0;
        const wasInclusive = taxable < grossAmount - 0.01 && Number(i.gstPct) > 0;
        return calcItem({$1gstInclusive: wasInclusive,
        }, interstate);
      }));
    }`
);

// Fix fromOrderId loading (line ~234)
invForm = invForm.replace(
  /if \(order\.items\?\.length\) \{\s*setItems\(order\.items\.map\(\(i: any\) => calcItem\(\{([\s\S]*?)gstInclusive:\s*false,\s*\}\), false\)\)\);\s*\}/g,
  `if (order.items?.length) {
        setItems(order.items.map((i: any) => {
          const qty = Number(i.quantity) || 0;
          const rate = Number(i.rate) || 0;
          const discPct = Number(i.discountPct) || 0;
          const grossAmount = (qty * rate) * (1 - discPct / 100);
          const taxable = Number(i.taxableAmount) || 0;
          const wasInclusive = taxable < grossAmount - 0.01 && Number(i.gstPct) > 0;
          return calcItem({$1gstInclusive: wasInclusive,
          }, false);
        }));
      }`
);
fs.writeFileSync(invFormPath, invForm);


// 2. Fix order-form.tsx
const ordFormPath = path.join(__dirname, 'artifacts/accounting-app/src/pages/sales/order-form.tsx');
let ordForm = fs.readFileSync(ordFormPath, 'utf8');

ordForm = ordForm.replace(
  /if \(o\.items\?\.length\) \{\s*setItems\(o\.items\.map\(\(i: any\) => calcItem\(\{([\s\S]*?)gstInclusive:\s*false,\s*\}\)\)\);\s*\}/g,
  `if (o.items?.length) {
      setItems(o.items.map((i: any) => {
        const qty = Number(i.quantity) || 0;
        const rate = Number(i.rate) || 0;
        const discPct = Number(i.discountPct) || 0;
        const grossAmount = (qty * rate) * (1 - discPct / 100);
        const taxable = Number(i.taxableAmount) || 0;
        const wasInclusive = taxable < grossAmount - 0.01 && Number(i.gstPct) > 0;
        return calcItem({$1gstInclusive: wasInclusive,
        });
      }));
    }`
);
fs.writeFileSync(ordFormPath, ordForm);

// 3. Fix sale-invoices.ts (unreserve stock on invoice create/edit if from order)
const saleInvPath = path.join(__dirname, 'artifacts/api-server/src/routes/sale-invoices.ts');
let saleInv = fs.readFileSync(saleInvPath, 'utf8');

// In POST /sale-invoices
if (!saleInv.includes('adjustReservedStock')) {
  saleInv = saleInv.replace('import { adjustStock } from "../lib/batch-stock";', 'import { adjustStock, adjustReservedStock } from "../lib/batch-stock";');
  saleInv = saleInv.replace(
    /if \(item\.stockItemId\) \{\s*const newBalance = await adjustStock\(item\.stockItemId, item\.batchId \|\| null, -Number\(item\.quantity\)\);/g,
    `if (item.stockItemId) {
        if (data.fromOrderId) {
          await adjustReservedStock(item.batchId || null, -Number(item.quantity));
        }
        const newBalance = await adjustStock(item.stockItemId, item.batchId || null, -Number(item.quantity));`
  );
}
fs.writeFileSync(saleInvPath, saleInv);

console.log("Patched forms and stock reservation logic successfully.");
