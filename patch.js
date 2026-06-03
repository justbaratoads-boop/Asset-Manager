const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'artifacts', 'api-server', 'src', 'routes', 'reports.ts');
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('partiesTable')) {
  code = code.replace(/\} from "@workspace\/db\/schema";/, ', partiesTable } from "@workspace/db/schema";');
}

const helper = `
async function getLedgersWithParties() {
  const [dbLedgers, parties] = await Promise.all([
    db.select().from(ledgersTable).where(eq(ledgersTable.isDeleted, "false")),
    db.select().from(partiesTable).where(eq(partiesTable.isDeleted, "false")),
  ]);
  const partyLedgers = parties.map(p => ({
    id: 1000000 + p.id,
    name: p.name,
    group: p.accountGroup || (p.type === 'customer' ? 'Sundry Debtors' : 'Sundry Creditors'),
    nature: p.balanceType || (p.type === 'customer' ? 'dr' : 'cr'),
    openingBalance: p.openingBalance,
  }));
  return [...dbLedgers, ...partyLedgers];
}
`;

if (!code.includes('getLedgersWithParties')) {
  code = code.replace('const router = Router();', 'const router = Router();\n' + helper);
}

// Replace DB fetching in all routes
code = code.replace(/db\.select\(\)\.from\(ledgersTable\)\.where\(eq\(ledgersTable\.isDeleted, "false"\)\)/g, 'getLedgersWithParties()');

// Fix inline queries
code = code.replace(/mode: saleInvoicePaymentsTable\.mode,\s*amount: saleInvoicePaymentsTable\.amount,/g, 'mode: saleInvoicePaymentsTable.mode,\n      amount: saleInvoicePaymentsTable.amount,\n      partyId: saleInvoicesTable.partyId,');
code = code.replace(/mode: purchaseInvoicePaymentsTable\.mode,\s*amount: purchaseInvoicePaymentsTable\.amount,/g, 'mode: purchaseInvoicePaymentsTable.mode,\n      amount: purchaseInvoicePaymentsTable.amount,\n      partyId: purchaseInvoicesTable.partyId,');

// Replace standard ledger IDs
code = code.replace(/inv\.partyId \? LEDGER\.ar/g, 'inv.partyId ? 1000000 + inv.partyId');
code = code.replace(/inv\.partyId \? LEDGER\.ap/g, 'inv.partyId ? 1000000 + inv.partyId');
code = code.replace(/add\(LEDGER\.ar, "cr", amount\);/g, 'add((typeof r !== "undefined" && r.partyId) ? 1000000 + r.partyId : ((typeof cn !== "undefined" && cn.partyId) ? 1000000 + cn.partyId : ((typeof p !== "undefined" && p.partyId) ? 1000000 + p.partyId : LEDGER.ar)), "cr", amount);');
code = code.replace(/add\(LEDGER\.ar, "cr", Number\(r\.amount\)\);/g, 'add(r.partyId ? 1000000 + r.partyId : LEDGER.ar, "cr", Number(r.amount));');
code = code.replace(/add\(LEDGER\.ar, "cr", Number\(cn\.amount\)\);/g, 'add(cn.partyId ? 1000000 + cn.partyId : LEDGER.ar, "cr", Number(cn.amount));');

code = code.replace(/add\(LEDGER\.ap, "dr", amount\);/g, 'add((typeof p !== "undefined" && p.partyId) ? 1000000 + p.partyId : ((typeof dn !== "undefined" && dn.partyId) ? 1000000 + dn.partyId : LEDGER.ap), "dr", amount);');
code = code.replace(/add\(LEDGER\.ap, "dr", Number\(p\.amount\)\);/g, 'add(p.partyId ? 1000000 + p.partyId : LEDGER.ap, "dr", Number(p.amount));');
code = code.replace(/add\(LEDGER\.ap, "dr", Number\(dn\.amount\)\);/g, 'add(dn.partyId ? 1000000 + dn.partyId : LEDGER.ap, "dr", Number(dn.amount));');

fs.writeFileSync(file, code);
console.log('Successfully patched reports.ts');
