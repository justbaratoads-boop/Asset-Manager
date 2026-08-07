const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');

  // Add imports if missing
  if (!content.includes('stockItemsTable')) {
    content = content.replace(
      'from "@workspace/db/schema";',
      ', stockItemsTable } from "@workspace/db/schema";'
    );
  }
  if (!content.includes('inArray')) {
    content = content.replace(
      'from "drizzle-orm";',
      ', inArray } from "drizzle-orm";'
    );
  }

  // Replace validation logic
  const oldLogic = `const hasInvalidItems = data.items.some((i: any) => isKacchaInvoice ? i.isTaxLiability !== false : i.isTaxLiability === false);`;
  
  const newLogic = `
    const stockItemIds = data.items.map((i: any) => i.stockItemId).filter(Boolean);
    const stockItems = stockItemIds.length ? await db.select().from(stockItemsTable).where(inArray(stockItemsTable.id, stockItemIds)) : [];
    const stockMap = Object.fromEntries(stockItems.map((s: any) => [s.id, s.isTaxLiability]));

    const hasInvalidItems = data.items.some((i: any) => {
       const isTax = i.isTaxLiability !== undefined ? i.isTaxLiability : stockMap[i.stockItemId] ?? true;
       return isKacchaInvoice ? isTax !== false : isTax === false;
    });
`;

  content = content.replace(oldLogic, newLogic);
  fs.writeFileSync(filepath, content);
}

patchFile('artifacts/api-server/src/routes/sale-invoices.ts');
patchFile('artifacts/api-server/src/routes/purchase.ts');
console.log('Done');
