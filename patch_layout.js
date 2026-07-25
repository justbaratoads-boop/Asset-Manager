const fs = require('fs');
const files = [
  'artifacts/accounting-app/src/pages/sales/invoice-list.tsx',
  'artifacts/accounting-app/src/pages/sales/orders.tsx',
  'artifacts/accounting-app/src/pages/purchase/invoice-list.tsx',
  'artifacts/accounting-app/src/pages/purchase/orders.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove "md:hidden" from card list
    content = content.replace(/className="md:hidden space-y-3"/g, 'className="space-y-3"');
    content = content.replace(/className="md:hidden"/g, 'className="mt-4"');
    
    // Comment out desktop table
    content = content.replace(/<Card className="hidden md:block">[\s\S]*?<\/Card>/, '');
    
    fs.writeFileSync(file, content);
    console.log('Patched layout:', file);
  }
}
