const fs = require('fs');
const file = 'artifacts/api-server/src/routes/users.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /enableDualLedger:\s*data\.enableDualLedger,\n\s*dualLedgerPassword:\s*data\.dualLedgerPassword/g;
content = content.replace(regex, 'enableDualLedger: data.enableDualLedger,\n    autoRoundOff: data.autoRoundOff,\n    dualLedgerPassword: data.dualLedgerPassword');

fs.writeFileSync(file, content);
console.log("Patched " + file);
