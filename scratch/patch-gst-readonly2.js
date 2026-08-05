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

  // 1. Replace GstToggle component definition (if exists)
  content = content.replace(
    /function GstToggle\(\{[^}]+\}\) \{[\s\S]*?return \([\s\S]*?<\/div>\s*\);\s*\}/g,
    `function GstToggle({ value }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="h-8 flex items-center justify-center bg-muted rounded border text-xs font-medium text-muted-foreground">
      {value ? "Inclusive" : "Exclusive"}
    </div>
  );
}`
  );

  // 2. Replace Mobile GST Type buttons
  content = content.replace(
    /<div className="flex rounded-md overflow-hidden border text-sm font-medium h-10">[\s\S]*?<button type="button" onClick=\{[^}]+\}[\s\S]*?Exclusive[\s\S]*?<\/button>[\s\S]*?<button type="button" onClick=\{[^}]+\}[\s\S]*?Inclusive[\s\S]*?<\/button>[\s\S]*?<\/div>/g,
    `<div className="flex items-center justify-center bg-muted rounded-md border text-sm font-medium text-muted-foreground h-10">
      {item.gstInclusive ? "Inclusive" : "Exclusive"}
    </div>`
  );

  // 3. Replace GST% select in purchase forms and others
  content = content.replace(
    /\{item\.gstLocked \? \([^)]+\) : \([^)]+Select value=\{String\(item\.gstPct\)\}[\s\S]*?<\/Select>\)\}/g,
    `<div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>`
  );

  // 4. Same for desktop GST% select
  content = content.replace(
    /\{item\.gstLocked \? \([^)]+\) : \([^)]+Select value=\{String\(item\.gstPct\)\}[\s\S]*?<\/Select>\)\}/g,
    `<div className="h-8 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>`
  );
  
  // Actually regex 3 and 4 might fail if there are nested brackets in the ternary. Let's do a more robust replace for the GST% select.
  content = content.replace(
    /\{item\.gstLocked \? \(\s*<div[^>]+><Lock[^>]*\/>\{item\.gstPct\}%<\/div>\s*\) : \(\s*<Select value=\{String\(item\.gstPct\)\}[^>]*>[\s\S]*?<\/Select>\s*\)\}/g,
    `<div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>`
  );
  
  // And for the desktop version which has h-8
  content = content.replace(
    /\{item\.gstLocked \? \(\s*<div[^>]+h-8[^>]+><Lock[^>]*\/>\{item\.gstPct\}%<\/div>\s*\) : \(\s*<Select value=\{String\(item\.gstPct\)\}[^>]*>[\s\S]*?<\/Select>\s*\)\}/g,
    `<div className="h-8 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>`
  );

  fs.writeFileSync(file, content);
}

console.log('Script loaded and run');
