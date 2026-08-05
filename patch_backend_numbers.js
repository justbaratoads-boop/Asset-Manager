const fs = require('fs');

const files = [
  'artifacts/api-server/src/routes/sale-invoices.ts',
  'artifacts/api-server/src/routes/purchase.ts',
  'artifacts/api-server/src/routes/accounting.ts' // if credit/debit notes are here
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Replace String(item.field || 0) with String(Number(item.field) || 0)
  content = content.replace(/String\((item\.quantity) \|\| 0\)/g, 'String(Number($1) || 0)');
  content = content.replace(/String\((item\.rate) \|\| 0\)/g, 'String(Number($1) || 0)');
  content = content.replace(/String\((item\.discountPct) \|\| 0\)/g, 'String(Number($1) || 0)');
  content = content.replace(/String\((item\.gstPct) \|\| 0\)/g, 'String(Number($1) || 0)');
  content = content.replace(/String\((item\.taxableAmount) \|\| 0\)/g, 'String(Number($1) || 0)');
  content = content.replace(/String\((item\.cgst) \|\| 0\)/g, 'String(Number($1) || 0)');
  content = content.replace(/String\((item\.sgst) \|\| 0\)/g, 'String(Number($1) || 0)');
  content = content.replace(/String\((item\.igst) \|\| 0\)/g, 'String(Number($1) || 0)');
  content = content.replace(/String\((item\.total) \|\| 0\)/g, 'String(Number($1) || 0)');
  
  // also pay.amount
  content = content.replace(/String\((pay\.amount) \|\| 0\)/g, 'String(Number($1) || 0)');

  fs.writeFileSync(file, content);
  console.log("Patched " + file);
}
