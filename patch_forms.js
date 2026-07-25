const fs = require('fs');
const files = [
  'artifacts/accounting-app/src/pages/sales/invoice-form.tsx',
  'artifacts/accounting-app/src/pages/sales/walkin.tsx',
  'artifacts/accounting-app/src/pages/purchase/invoice-form.tsx',
  'artifacts/accounting-app/src/pages/sales/credit-note-form.tsx',
  'artifacts/accounting-app/src/pages/purchase/debit-note-form.tsx',
  'artifacts/accounting-app/src/pages/sales/order-form.tsx',
  'artifacts/accounting-app/src/pages/purchase/order-form.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('items: computedItems')) {
       console.log('Already patched:', file);
       continue;
    }
    // Replace 'items,' or 'items\n' in buildPayload
    // We can do a regex to specifically replace it inside buildPayload
    content = content.replace(/notes,\s*items,\s*payments,/g, 'notes,\n        items: computedItems,\n        payments,');
    fs.writeFileSync(file, content);
    console.log('Patched:', file);
  }
}
