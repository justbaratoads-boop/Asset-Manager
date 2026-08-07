const fs = require('fs');

function fixFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(/\n, stockItemsTable/g, '\n  stockItemsTable');
  content = content.replace(/companySettingsTable\n  stockItemsTable/g, 'companySettingsTable,\n  stockItemsTable');
  content = content.replace(/ordersTable,\n  stockItemsTable/g, 'ordersTable,\n  stockItemsTable');
  
  // also fix double comma in import if any, e.g. `ne , inArray` to `ne, inArray`
  content = content.replace(/ , /g, ', ');
  
  fs.writeFileSync(filepath, content);
}

fixFile('artifacts/api-server/src/routes/sale-invoices.ts');
fixFile('artifacts/api-server/src/routes/purchase.ts');
console.log('Fixed syntax errors');
