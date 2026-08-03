const fs = require('fs');
const file = 'artifacts/api-server/src/routes/reports.ts';
let content = fs.readFileSync(file, 'utf8');

const helper = `
import { companySettingsTable } from "@workspace/db/schema";
async function getEnableDualLedger() {
  const [settings] = await db.select().from(companySettingsTable).limit(1);
  return settings?.enableDualLedger ?? false;
}
`;
if (!content.includes('getEnableDualLedger')) {
  content = content.replace('const router = Router();', 'const router = Router();\n' + helper);
}

const routes = [
  "/reports/day-book",
  "/reports/trial-balance",
  "/reports/profit-loss",
  "/reports/balance-sheet",
  "/reports/sale-register",
  "/reports/purchase-register",
  "/reports/cash-book",
  "/reports/bank-book",
  "/reports/party-statement"
];

for (const route of routes) {
  const regex = new RegExp(`router\\.get\\("${route}",\\s*authMiddleware,\\s*async\\s*\\(req,\\s*res\\)\\s*=>\\s*\\{`);
  content = content.replace(regex, `router.get("${route}", authMiddleware, async (req, res) => {\n  const enableDualLedger = await getEnableDualLedger();`);
}

const tables = [
  'saleInvoicesTable', 'purchaseInvoicesTable', 'paymentsTable', 'receiptsTable', 'journalEntriesTable', 'ordersTable', 'creditNotesTable', 'debitNotesTable'
];

for (const table of tables) {
  const regex = new RegExp(`eq\\(${table}\\.isDeleted,\\s*"false"\\)`, 'g');
  content = content.replace(regex, `and(eq(${table}.isDeleted, "false"), enableDualLedger ? sql\`true\` : eq(${table}.isKaccha, false))`);
}

fs.writeFileSync(file, content);
console.log('Patched reports.ts');
