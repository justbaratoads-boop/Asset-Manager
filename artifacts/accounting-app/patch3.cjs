const fs = require('fs');

function patchInvoiceForm(file) {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Fix missing import
  if (!content.includes('import { computeInvoice }')) {
    content = content.replace(/import \{ getGstRateForDate \} from ".*lib\/gst";/, 'import { getGstRateForDate, computeInvoice } from "../../lib/gst";');
    
    // If it STILL doesn't include it (because getGstRateForDate wasn't there), find another line
    if (!content.includes('computeInvoice')) {
      content = content.replace(/import \{ formatCurrency, today, GST_RATES \} from "@\/lib\/format";/, 'import { formatCurrency, today, GST_RATES } from "@/lib/format";\nimport { computeInvoice } from "@/lib/gst";');
    }
  }

  // Remove ts-nocheck
  content = content.replace(/\/\/ @ts-nocheck\r?\n/, '');

  // For the other forms (purchase, credit-note, debit-note), they might have a different totals shape.
  // We need to carefully replace them if they haven't been replaced.
  const totalsBlockRegex2 = /const totals = \{\s*subtotal: items\.reduce\(\(s, i\) => s \+ i\.quantity \* i\.rate, 0\),[\s\S]*?grand: items\.reduce\(\(s, i\) => s \+ i\.total, 0\),\s*\};/g;
  if (totalsBlockRegex2.test(content)) {
    content = content.replace(totalsBlockRegex2, 'const { items: computedItems, totals: cTotals } = computeInvoice(items, charges, isInterstate, enableDualLedger ? !items.some(i => i.isTaxLiability) : false);\n  const totals = { ...cTotals, grand: cTotals.grand - cTotals.chargesTotal };');
    
    // Replace items.map with computedItems.map in render
    content = content.replace(/\{items\.map\(\(item, index\) => \(/g, '{computedItems.map((item, index) => (');
    
    // In buildPayload
    content = content.replace(/items,\n\s*payments,/g, 'items: computedItems,\n        payments,');
    
    // Remove calcItem inside updateItem
    content = content.replace(/updated\[index\] = calcItem\(\{ \.\.\.updated\[index\], \[field\]: value \}, isInterstate\);/g, 'updated[index] = { ...updated[index], [field]: value };');
    content = content.replace(/updated\[index\] = calcItem\(\{ \.\.\.updated\[index\], stockItemId: si\.id, batchId: si\.batchId \? Number\(si\.batchId\) : undefined, itemName: si\.name, hsnCode: si\.hsnCode \|\| "", unit: si\.unit, rate: si\.saleRate \|\| si\.purchaseRate, gstPct, quantity: si\.unit === "n\/a" \? 1 : updated\[index\]\.quantity, gstLocked: true, isTaxLiability: si\.isTaxLiability \?\? true \}, isInterstate\);/g, 'updated[index] = { ...updated[index], stockItemId: si.id, batchId: si.batchId ? Number(si.batchId) : undefined, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.saleRate || si.purchaseRate, gstPct, quantity: si.unit === "n/a" ? 1 : updated[index].quantity, gstLocked: true, isTaxLiability: si.isTaxLiability ?? true };');
    content = content.replace(/updated\[index\] = calcItem\(\{ \.\.\.updated\[index\], stockItemId: undefined, batchId: undefined, itemName: "", hsnCode: "", gstLocked: false, isTaxLiability: true \}, isInterstate\);/g, 'updated[index] = { ...updated[index], stockItemId: undefined, batchId: undefined, itemName: "", hsnCode: "", gstLocked: false, isTaxLiability: true };');
  }

  // Handle the different updateItem regex for purchase/credit notes
  content = content.replace(/updated\[index\] = calcItem\(\{ \.\.\.updated\[index\], stockItemId: si\.id, batchId: si\.batchId \? Number\(si\.batchId\) : undefined, itemName: si\.name, hsnCode: si\.hsnCode \|\| "", unit: si\.unit, rate: si\.purchaseRate \|\| si\.saleRate, gstPct, quantity: si\.unit === "n\/a" \? 1 : updated\[index\]\.quantity, gstLocked: true, isTaxLiability: si\.isTaxLiability \?\? true \}, isInterstate\);/g, 'updated[index] = { ...updated[index], stockItemId: si.id, batchId: si.batchId ? Number(si.batchId) : undefined, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.purchaseRate || si.saleRate, gstPct, quantity: si.unit === "n/a" ? 1 : updated[index].quantity, gstLocked: true, isTaxLiability: si.isTaxLiability ?? true };');

  fs.writeFileSync(file, content);
}

const files = [
  'src/pages/sales/invoice-form.tsx',
  'src/pages/purchase/invoice-form.tsx',
  'src/pages/accounts/credit-note-form.tsx',
  'src/pages/accounts/debit-note-form.tsx'
];

for (const file of files) {
  patchInvoiceForm(file);
}
console.log("Done");
