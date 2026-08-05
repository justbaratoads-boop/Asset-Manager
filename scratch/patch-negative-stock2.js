const fs = require('fs');

// Patch batch-stock.ts line 71
const stockPath = 'artifacts/api-server/src/lib/batch-stock.ts';
let stockContent = fs.readFileSync(stockPath, 'utf8');
stockContent = stockContent.replace(/Math\.max\(0, Number\(b\?\.ps \|\| 0\) \+ physicalDelta\)/g, 'Number(b?.ps || 0) + physicalDelta');
fs.writeFileSync(stockPath, stockContent);

// Patch stock.ts line 123
const stockRoutePath = 'artifacts/api-server/src/routes/stock.ts';
let stockRouteContent = fs.readFileSync(stockRoutePath, 'utf8');
stockRouteContent = stockRouteContent.replace(/Math\.max\(0, Number\(existing\.physicalStock \|\| 0\) \+ delta\)/g, 'Number(existing.physicalStock || 0) + delta');
fs.writeFileSync(stockRoutePath, stockRouteContent);

console.log('Patched remaining negative stock clamps.');
