const fs = require('fs');

function fixFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace('} , stockItemsTable }', ', stockItemsTable }');
  content = content.replace('} , inArray }', ', inArray }');
  fs.writeFileSync(filepath, content);
}

fixFile('artifacts/api-server/src/routes/sale-invoices.ts');
fixFile('artifacts/api-server/src/routes/purchase.ts');
console.log('Fixed');
