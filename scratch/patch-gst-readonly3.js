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

  // Replace GstToggle function
  content = content.replace(
    /function GstToggle\(\{.*?\} \)\s*\{[\s\S]*?return \([\s\S]*?<\/div>\s*\);\s*\}/g,
    `function GstToggle({ value }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="h-8 flex items-center justify-center bg-muted rounded border text-xs font-medium text-muted-foreground">
      {value ? "Inclusive" : "Exclusive"}
    </div>
  );
}`
  );
  // Also try replacing without the space before ')'
  content = content.replace(
    /function GstToggle\(\{.*?\}\)\s*\{[\s\S]*?return \([\s\S]*?<\/div>\s*\);\s*\}/g,
    `function GstToggle({ value }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="h-8 flex items-center justify-center bg-muted rounded border text-xs font-medium text-muted-foreground px-2">
      {value ? "In" : "Ex"}
    </div>
  );
}`
  );

  // Replace mobile exclusive/inclusive buttons
  content = content.replace(
    /<div className="flex[^>]*?h-10[^>]*">\s*<button[^>]*>[\s\S]*?Exclusive[\s\S]*?<\/button>\s*<button[^>]*>[\s\S]*?Inclusive[\s\S]*?<\/button>\s*<\/div>/g,
    `<div className="flex items-center justify-center bg-muted rounded-md border text-sm font-medium text-muted-foreground h-10">
      {item.gstInclusive ? "Inclusive" : "Exclusive"}
    </div>`
  );
  
  // also look for the ones in purchase forms that have diff classNames or styles
  content = content.replace(
    /<div className="flex[^>]*">\s*<button[^>]*onClick=\{\(\) => updateItem[^>]*>[\s\S]*?Ex(clusive)?[\s\S]*?<\/button>\s*<button[^>]*onClick=\{\(\) => updateItem[^>]*>[\s\S]*?In(clusive)?[\s\S]*?<\/button>\s*<\/div>/g,
    `<div className="h-8 flex items-center justify-center bg-muted rounded border text-xs font-medium text-muted-foreground">
      {item.gstInclusive ? "In" : "Ex"}
    </div>`
  );

  fs.writeFileSync(file, content);
}

console.log('Script loaded and run');
