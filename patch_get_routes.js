const fs = require('fs');

function patchGetRoute(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  const regex = /items:\s*items\.map\(i\s*=>\s*\(\{\s*\.\.\.i,\s*quantity:\s*Number\(i\.quantity\),\s*rate:\s*Number\(i\.rate\),\s*total:\s*Number\(i\.total\),\s*cgst:\s*Number\(i\.cgst\),\s*sgst:\s*Number\(i\.sgst\),\s*igst:\s*Number\(i\.igst\)\s*\}\)\)/g;
  
  const replacement = `items: items.map(i => ({ ...i, quantity: Number(i.quantity || 0), rate: Number(i.rate || 0), discountPct: Number(i.discountPct || 0), gstPct: Number(i.gstPct || 0), taxableAmount: Number(i.taxableAmount || 0), total: Number(i.total || 0), cgst: Number(i.cgst || 0), sgst: Number(i.sgst || 0), igst: Number(i.igst || 0) }))`;
  
  if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync(filePath, code);
    console.log(`Patched GET route in ${filePath}`);
  } else {
    console.log(`Could not find GET route items map in ${filePath}`);
  }
}

patchGetRoute('artifacts/api-server/src/routes/sale-invoices.ts');
patchGetRoute('artifacts/api-server/src/routes/purchase.ts');
