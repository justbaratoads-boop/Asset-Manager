const fs = require('fs');

function patchPutRoute(file, routePrefix, tableName) {
  let f = fs.readFileSync(file, 'utf8');

  // Need to add companySettingsTable to imports if not present
  if (!f.includes('companySettingsTable')) {
    f = f.replace(
      'purchaseOrdersTable, purchaseOrderItemsTable, stockTransactionsTable',
      'purchaseOrdersTable, purchaseOrderItemsTable, stockTransactionsTable, companySettingsTable'
    );
  }

  const putHeader = `router.put("${routePrefix}/:id", authMiddleware, async (req, res) => {`;
  if (!f.includes(putHeader)) {
    console.error("Could not find PUT route in " + file);
    return;
  }

  const validationCode = `
  const data = req.body;
  
  const [existingInvoice] = await db.select().from(${tableName}).where(eq(${tableName}.id, Number(req.params.id))).limit(1);
  if (!existingInvoice) return res.status(404).json({ error: "Not found" });

  const settings = await db.select().from(companySettingsTable).limit(1);
  const enableDualLedger = settings[0]?.enableDualLedger === "true" || settings[0]?.enableDualLedger === true;

  if (enableDualLedger && data.items?.length) {
    const isKacchaInvoice = existingInvoice.isKaccha;
    const hasInvalidItems = data.items.some((i: any) => isKacchaInvoice ? i.isTaxLiability !== false : i.isTaxLiability === false);
    
    if (hasInvalidItems) {
      return res.status(400).json({ error: isKacchaInvoice ? "Cannot add Pakka (taxable) items to a Kaccha bill." : "Cannot add Kaccha (non-taxable) items to a Pakka bill." });
    }
  }
`;

  // Insert the validation code right after the data = req.body;
  const target = `const data = req.body;`;
  const insertIndex = f.indexOf(target, f.indexOf(putHeader));
  if (insertIndex > -1) {
    const before = f.substring(0, insertIndex);
    const after = f.substring(insertIndex + target.length);
    f = before + validationCode + after;
    fs.writeFileSync(file, f);
    console.log("Patched " + file);
  } else {
    console.error("Could not find data = req.body in " + file);
  }
}

patchPutRoute('artifacts/api-server/src/routes/sale-invoices.ts', '/sale-invoices', 'saleInvoicesTable');
patchPutRoute('artifacts/api-server/src/routes/purchase.ts', '/purchase-invoices', 'purchaseInvoicesTable');
