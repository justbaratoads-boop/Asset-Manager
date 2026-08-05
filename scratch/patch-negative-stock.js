const fs = require('fs');

// Patch batch-stock.ts
const stockPath = 'artifacts/api-server/src/lib/batch-stock.ts';
let stockContent = fs.readFileSync(stockPath, 'utf8');
stockContent = stockContent.replace(/Math\.max\(0, Number\(\(b\?\.ps\) \|\| 0\) \+ delta\)/g, 'Number((b?.ps) || 0) + delta');
stockContent = stockContent.replace(/Math\.max\(0, Number\(\(item\?\.ps\) \|\| 0\) \+ delta\)/g, 'Number((item?.ps) || 0) + delta');
stockContent = stockContent.replace(/Math\.max\(0, Number\(b\?\.ps \|\| 0\) \+ delta\)/g, 'Number(b?.ps || 0) + delta');
stockContent = stockContent.replace(/Math\.max\(0, Number\(item\?\.ps \|\| 0\) \+ delta\)/g, 'Number(item?.ps || 0) + delta');
fs.writeFileSync(stockPath, stockContent);

// Patch reports.ts
const reportsPath = 'artifacts/api-server/src/routes/reports.ts';
let reportsContent = fs.readFileSync(reportsPath, 'utf8');
reportsContent = reportsContent.replace(/Math\.max\(0, closingQty\)/g, 'closingQty');
fs.writeFileSync(reportsPath, reportsContent);

console.log('Patched negative stock logic.');
