const fs = require('fs');
const filePath = 'artifacts/api-server/src/routes/purchase.ts';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /res\.json\(\{\s*\.\.\.invoice,\s*grandTotal:\s*Number\(invoice\.grandTotal\),\s*items,\s*payments\s*\}\);/g,
  `res.json({ ...invoice, grandTotal: Number(invoice.grandTotal), items: items.map(i => ({ ...i, quantity: Number(i.quantity || 0), rate: Number(i.rate || 0), discountPct: Number(i.discountPct || 0), gstPct: Number(i.gstPct || 0), taxableAmount: Number(i.taxableAmount || 0), total: Number(i.total || 0), cgst: Number(i.cgst || 0), sgst: Number(i.sgst || 0), igst: Number(i.igst || 0) })), payments });`
);

fs.writeFileSync(filePath, code);
console.log('Patched purchase.ts');
