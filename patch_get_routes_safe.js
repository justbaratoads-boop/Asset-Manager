const fs = require('fs');
function safeNum(val) {
  return `(isNaN(Number(${val})) ? 0 : Number(${val}))`;
}

function patchGetRoute(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  const regex = /items:\s*items\.map\(i\s*=>\s*\(\{\s*\.\.\.i,\s*quantity:\s*Number\(i\.quantity\s*\|\|\s*0\),\s*rate:\s*Number\(i\.rate\s*\|\|\s*0\),\s*discountPct:\s*Number\(i\.discountPct\s*\|\|\s*0\),\s*gstPct:\s*Number\(i\.gstPct\s*\|\|\s*0\),\s*taxableAmount:\s*Number\(i\.taxableAmount\s*\|\|\s*0\),\s*total:\s*Number\(i\.total\s*\|\|\s*0\),\s*cgst:\s*Number\(i\.cgst\s*\|\|\s*0\),\s*sgst:\s*Number\(i\.sgst\s*\|\|\s*0\),\s*igst:\s*Number\(i\.igst\s*\|\|\s*0\)\s*\}\)\)/g;
  
  const replacement = `items: items.map(i => ({ ...i, quantity: ${safeNum('i.quantity')}, rate: ${safeNum('i.rate')}, discountPct: ${safeNum('i.discountPct')}, gstPct: ${safeNum('i.gstPct')}, taxableAmount: ${safeNum('i.taxableAmount')}, total: ${safeNum('i.total')}, cgst: ${safeNum('i.cgst')}, sgst: ${safeNum('i.sgst')}, igst: ${safeNum('i.igst')} }))`;
  
  if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync(filePath, code);
    console.log(`Patched GET route safely in ${filePath}`);
  } else {
    console.log(`Could not find GET route items map in ${filePath}`);
  }
}

patchGetRoute('artifacts/api-server/src/routes/sale-invoices.ts');
patchGetRoute('artifacts/api-server/src/routes/purchase.ts');
