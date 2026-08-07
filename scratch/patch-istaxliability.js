const fs = require('fs');

const files = [
  'artifacts/accounting-app/src/pages/sales/invoice-form.tsx',
  'artifacts/accounting-app/src/pages/purchase/invoice-form.tsx',
  'artifacts/accounting-app/src/pages/sales/order-form.tsx',
  'artifacts/accounting-app/src/pages/purchase/order-form.tsx',
  'artifacts/accounting-app/src/pages/accounts/credit-note-form.tsx',
  'artifacts/accounting-app/src/pages/accounts/debit-note-form.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    /gstLocked:\s*!!i\.stockItemId,\s*gstInclusive:\s*(false|wasInclusive|true)(?!\s*,\s*isTaxLiability),/g,
    'gstLocked: !!i.stockItemId, gstInclusive: $1, isTaxLiability: i.isTaxLiability,'
  );

  fs.writeFileSync(file, content);
}
console.log('Done');
