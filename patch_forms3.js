const fs = require('fs');
const files = [
  'artifacts/accounting-app/src/pages/sales/walkin.tsx',
  'artifacts/accounting-app/src/pages/sales/order-form.tsx',
  'artifacts/accounting-app/src/pages/purchase/order-form.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/notes,\s*items,\s*payments,/g, 'notes,\n        items: computedItems,\n        payments,');
    fs.writeFileSync(file, content);
    console.log('Patched correctly:', file);
  }
}
