const fs = require('fs');

const files = [
  'artifacts/accounting-app/src/pages/sales/invoice-form.tsx',
  'artifacts/accounting-app/src/pages/purchase/invoice-form.tsx',
  'artifacts/accounting-app/src/pages/accounts/credit-note-form.tsx',
  'artifacts/accounting-app/src/pages/accounts/debit-note-form.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Extract the useEffect block for autoRoundOff
  const match = content.match(/(\s*useEffect\(\(\) => \{\s*if \(!autoRoundOff\) return;[\s\S]*?\}, \[.*?computedItems.*?\]\);\s*)/);
  if (match) {
    const effectBlock = match[1];
    
    // Check if the effectBlock is located BEFORE the computedItems declaration
    const effectIndex = content.indexOf(effectBlock);
    const computedItemsIndex = content.indexOf('const { items: computedItems');
    if (computedItemsIndex === -1 && file.includes('note-form')) {
        // for credit/debit notes, it might just be 'const computedItems ='
        const computedItemsIndex2 = content.indexOf('const computedItems');
        if (effectIndex < computedItemsIndex2) {
           content = content.replace(effectBlock, '\n');
           const targetIndex = content.lastIndexOf('return (');
           content = content.slice(0, targetIndex) + effectBlock + '\n  ' + content.slice(targetIndex);
           fs.writeFileSync(file, content);
           console.log(`Fixed TDZ in ${file}`);
        } else {
           console.log(`No TDZ found in ${file} or already fixed`);
        }
    } else if (effectIndex < computedItemsIndex) {
      // Remove it from its current position
      content = content.replace(effectBlock, '\n');
      
      // Insert it right before the `return (` statement at the end of the component
      const targetIndex = content.lastIndexOf('return (');
      if (targetIndex !== -1) {
        content = content.slice(0, targetIndex) + effectBlock + '\n  ' + content.slice(targetIndex);
        fs.writeFileSync(file, content);
        console.log(`Fixed TDZ in ${file}`);
      } else {
        console.error(`Could not find 'return (' in ${file}`);
      }
    } else {
      console.log(`No TDZ found in ${file} or already fixed`);
    }
  } else {
    console.log(`Could not find autoRoundOff useEffect block in ${file}`);
  }
}
