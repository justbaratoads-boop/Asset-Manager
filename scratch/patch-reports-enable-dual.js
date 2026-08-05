const fs = require('fs');
const filepath = 'artifacts/api-server/src/routes/reports.ts';
let content = fs.readFileSync(filepath, 'utf8');

const endpointsToPatch = [
  '/reports/all-transactions',
  '/reports/stock-summary',
  '/reports/stock-summary-batch',
  '/reports/delivery-report',
  '/reports/stock-current',
  '/stock-availability',
  '/reports/stock-ledger/:id',
  '/reports/stock-batch-ledger'
];

for (const ep of endpointsToPatch) {
  const regexStr = `(router\\.get\\("${ep}",\\s*authMiddleware,\\s*async\\s*\\(req,\\s*res\\)\\s*=>\\s*\\{)`;
  const regex = new RegExp(regexStr);
  if (content.match(regex)) {
    if (!content.match(new RegExp(`router\\.get\\("${ep}"[\\s\\S]*?const enableDualLedger = await getEnableDualLedger\\(\\);`))) {
      content = content.replace(regex, `$1\n    const enableDualLedger = await getEnableDualLedger();`);
    }
  }
}

fs.writeFileSync(filepath, content);
console.log('Patched reports.ts successfully.');
