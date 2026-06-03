const fs = require('fs');
const path = require('path');

// 1. Update accounting.ts
const accPath = path.join(__dirname, 'artifacts/api-server/src/routes/accounting.ts');
let accCode = fs.readFileSync(accPath, 'utf8');

if (!accCode.includes('partiesTable.name')) {
  accCode = accCode.replace(
    'import {\n  journalEntriesTable, journalLinesTable',
    'import {\n  journalEntriesTable, journalLinesTable, partiesTable'
  );

  accCode = accCode.replace(
    /ledgerName: ledgersTable\.name,\n\s*partyId: journalLinesTable\.partyId,/,
    `ledgerName: ledgersTable.name,\n    partyId: journalLinesTable.partyId,\n    partyName: partiesTable.name,`
  );

  accCode = accCode.replace(
    /\.leftJoin\(ledgersTable, eq\(journalLinesTable\.ledgerId, ledgersTable\.id\)\)/,
    `.leftJoin(ledgersTable, eq(journalLinesTable.ledgerId, ledgersTable.id))\n    .leftJoin(partiesTable, eq(journalLinesTable.partyId, partiesTable.id))`
  );
  
  fs.writeFileSync(accPath, accCode);
}

// 2. Update journal.tsx
const viewPath = path.join(__dirname, 'artifacts/accounting-app/src/pages/accounts/journal.tsx');
let viewCode = fs.readFileSync(viewPath, 'utf8');

viewCode = viewCode.replace(
  /\{l\.ledgerName \|\| <span className="text-muted-foreground italic">Ledger #\{l\.ledgerId\}<\/span>\}/g,
  `{l.ledgerName || l.partyName || <span className="text-muted-foreground italic">Ledger #{l.ledgerId || 0}</span>}`
);
fs.writeFileSync(viewPath, viewCode);

// 3. Update journal-form.tsx for mandatory narration
const formPath = path.join(__dirname, 'artifacts/accounting-app/src/pages/accounts/journal-form.tsx');
let formCode = fs.readFileSync(formPath, 'utf8');

// Inside handleSubmit, before flatLines:
if (!formCode.includes('!narration.trim()')) {
  formCode = formCode.replace(
    'const flatLines:',
    `if (!narration.trim()) {
      toast({ title: "Validation Error", description: "Narration is mandatory", variant: "destructive" });
      return;
    }
    const flatLines:`
  );
  fs.writeFileSync(formPath, formCode);
}

console.log("Patched successfully");
