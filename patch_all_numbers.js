const fs = require('fs');

const files = [
  'artifacts/api-server/src/routes/sale-invoices.ts',
  'artifacts/api-server/src/routes/purchase.ts',
  'artifacts/api-server/src/routes/accounting.ts'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  const replacements = [
    [/String\(item\.quantity\)/g, 'String(Number(item.quantity) || 0)'],
    [/String\(item\.rate\)/g, 'String(Number(item.rate) || 0)'],
    [/String\(item\.taxableAmount\)/g, 'String(Number(item.taxableAmount) || 0)'],
    [/String\(item\.total\)/g, 'String(Number(item.total) || 0)'],
    [/String\(item\.cgst\)/g, 'String(Number(item.cgst) || 0)'],
    [/String\(item\.sgst\)/g, 'String(Number(item.sgst) || 0)'],
    [/String\(item\.igst\)/g, 'String(Number(item.igst) || 0)'],
    
    // Some are like String(isKaccha ? 0 : (item.cgst || 0))
    [/String\(isKaccha \? 0 : \(item\.cgst \|\| 0\)\)/g, 'String(isKaccha ? 0 : (Number(item.cgst) || 0))'],
    [/String\(isKaccha \? 0 : \(item\.sgst \|\| 0\)\)/g, 'String(isKaccha ? 0 : (Number(item.sgst) || 0))'],
    [/String\(isKaccha \? 0 : \(item\.igst \|\| 0\)\)/g, 'String(isKaccha ? 0 : (Number(item.igst) || 0))'],
    [/String\(isKaccha \? 0 : \(item\.gstPct \|\| 0\)\)/g, 'String(isKaccha ? 0 : (Number(item.gstPct) || 0))'],
    
    // Handle payments
    [/String\(payment\.amount\)/g, 'String(Number(payment.amount) || 0)'],
    [/String\(pay\.amount\)/g, 'String(Number(pay.amount) || 0)']
  ];

  for (const [regex, replacement] of replacements) {
    content = content.replace(regex, replacement);
  }

  fs.writeFileSync(file, content);
  console.log("Fully Patched " + file);
}
