const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\(data\.kacchaSubtotal \?\? data\.subtotal \|\| 0\)/g, '((data.kacchaSubtotal ?? data.subtotal) || 0)');
  content = content.replace(/\(data\.kacchaGrandTotal \?\? data\.grandTotal \|\| 0\)/g, '((data.kacchaGrandTotal ?? data.grandTotal) || 0)');
  content = content.replace(/\(data\.kacchaAmountPaid \?\? data\.amountPaid \|\| 0\)/g, '((data.kacchaAmountPaid ?? data.amountPaid) || 0)');
  content = content.replace(/\(data\.kacchaBalanceDue \?\? data\.balanceDue \|\| 0\)/g, '((data.kacchaBalanceDue ?? data.balanceDue) || 0)');
  fs.writeFileSync(file, content);
}

fixFile('artifacts/api-server/src/routes/sale-invoices.ts');
fixFile('artifacts/api-server/src/routes/purchase.ts');
console.log('Fixed syntax in both files.');
