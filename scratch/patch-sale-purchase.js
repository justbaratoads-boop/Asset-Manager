const fs = require('fs');

function patchSaleInvoices() {
  const file = 'artifacts/api-server/src/routes/sale-invoices.ts';
  let content = fs.readFileSync(file, 'utf8');

  // Fix GET /sale-invoices/:id
  content = content.replace(
    `const items = await db.select().from(saleInvoiceItemsTable).where(eq(saleInvoiceItemsTable.invoiceId, Number(id)));`,
    `const items = await db.select({
    id: saleInvoiceItemsTable.id,
    invoiceId: saleInvoiceItemsTable.invoiceId,
    stockItemId: saleInvoiceItemsTable.stockItemId,
    itemName: saleInvoiceItemsTable.itemName,
    hsnCode: saleInvoiceItemsTable.hsnCode,
    quantity: saleInvoiceItemsTable.quantity,
    unit: saleInvoiceItemsTable.unit,
    rate: saleInvoiceItemsTable.rate,
    discountPct: saleInvoiceItemsTable.discountPct,
    gstPct: saleInvoiceItemsTable.gstPct,
    taxableAmount: saleInvoiceItemsTable.taxableAmount,
    cgst: saleInvoiceItemsTable.cgst,
    sgst: saleInvoiceItemsTable.sgst,
    igst: saleInvoiceItemsTable.igst,
    total: saleInvoiceItemsTable.total,
    batchId: saleInvoiceItemsTable.batchId,
    description: saleInvoiceItemsTable.description,
    isTaxLiability: stockItemsTable.isTaxLiability,
  }).from(saleInvoiceItemsTable).leftJoin(stockItemsTable, eq(saleInvoiceItemsTable.stockItemId, stockItemsTable.id)).where(eq(saleInvoiceItemsTable.invoiceId, Number(id)));`
  );

  // Fix GET /sale-invoices/:id mapping to pass isTaxLiability
  content = content.replace(
    `igst: (isNaN(Number(i.igst)) ? 0 : Number(i.igst)) })),`,
    `igst: (isNaN(Number(i.igst)) ? 0 : Number(i.igst)), isTaxLiability: i.isTaxLiability ?? true })),`
  );

  // Fix PUT /sale-invoices/:id fields
  content = content.replace(
    `subtotal: String(data.subtotal || 0),
    totalDiscount: String(data.totalDiscount || 0),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    totalGst: String(data.totalGst || 0),
    grandTotal: String(data.grandTotal || 0),
    amountPaid: String(data.amountPaid || 0),
    balanceDue: String(data.balanceDue || 0),
    notes: data.notes,
    otherCharges: data.otherCharges || null,`,
    `subtotal: String(existingInvoice.isKaccha ? (data.kacchaSubtotal ?? data.subtotal || 0) : (data.subtotal || 0)),
    totalDiscount: String(data.totalDiscount || 0),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    totalGst: String(data.totalGst || 0),
    grandTotal: String(existingInvoice.isKaccha ? (data.kacchaGrandTotal ?? data.grandTotal || 0) : (data.grandTotal || 0)),
    amountPaid: String(existingInvoice.isKaccha ? (data.kacchaAmountPaid ?? data.amountPaid || 0) : (data.amountPaid || 0)),
    balanceDue: String(existingInvoice.isKaccha ? (data.kacchaBalanceDue ?? data.balanceDue || 0) : (data.balanceDue || 0)),
    notes: data.notes,
    otherCharges: existingInvoice.isKaccha ? (data.kacchaCharges ? JSON.stringify(data.kacchaCharges) : null) : (data.otherCharges || null),`
  );

  fs.writeFileSync(file, content);
}

function patchPurchaseInvoices() {
  const file = 'artifacts/api-server/src/routes/purchase.ts';
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    `const items = await db.select().from(purchaseInvoiceItemsTable).where(eq(purchaseInvoiceItemsTable.invoiceId, Number(id)));`,
    `const items = await db.select({
    id: purchaseInvoiceItemsTable.id,
    invoiceId: purchaseInvoiceItemsTable.invoiceId,
    stockItemId: purchaseInvoiceItemsTable.stockItemId,
    itemName: purchaseInvoiceItemsTable.itemName,
    hsnCode: purchaseInvoiceItemsTable.hsnCode,
    quantity: purchaseInvoiceItemsTable.quantity,
    unit: purchaseInvoiceItemsTable.unit,
    rate: purchaseInvoiceItemsTable.rate,
    discountPct: purchaseInvoiceItemsTable.discountPct,
    gstPct: purchaseInvoiceItemsTable.gstPct,
    taxableAmount: purchaseInvoiceItemsTable.taxableAmount,
    cgst: purchaseInvoiceItemsTable.cgst,
    sgst: purchaseInvoiceItemsTable.sgst,
    igst: purchaseInvoiceItemsTable.igst,
    total: purchaseInvoiceItemsTable.total,
    batchId: purchaseInvoiceItemsTable.batchId,
    isTaxLiability: stockItemsTable.isTaxLiability,
  }).from(purchaseInvoiceItemsTable).leftJoin(stockItemsTable, eq(purchaseInvoiceItemsTable.stockItemId, stockItemsTable.id)).where(eq(purchaseInvoiceItemsTable.invoiceId, Number(id)));`
  );

  content = content.replace(
    `igst: (isNaN(Number(i.igst)) ? 0 : Number(i.igst)) })),`,
    `igst: (isNaN(Number(i.igst)) ? 0 : Number(i.igst)), isTaxLiability: i.isTaxLiability ?? true })),`
  );

  content = content.replace(
    `subtotal: String(data.subtotal || 0),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    totalGst: String(data.totalGst || 0),
    grandTotal: String(data.grandTotal || 0),
    amountPaid: String(data.amountPaid || 0),
    balanceDue: String(data.balanceDue || 0),
    notes: data.notes,
    otherCharges: data.otherCharges || null,`,
    `subtotal: String(existingInvoice.isKaccha ? (data.kacchaSubtotal ?? data.subtotal || 0) : (data.subtotal || 0)),
    totalTaxable: String(data.totalTaxable || 0),
    totalCgst: String(data.totalCgst || 0),
    totalSgst: String(data.totalSgst || 0),
    totalIgst: String(data.totalIgst || 0),
    totalGst: String(data.totalGst || 0),
    grandTotal: String(existingInvoice.isKaccha ? (data.kacchaGrandTotal ?? data.grandTotal || 0) : (data.grandTotal || 0)),
    amountPaid: String(existingInvoice.isKaccha ? (data.kacchaAmountPaid ?? data.amountPaid || 0) : (data.amountPaid || 0)),
    balanceDue: String(existingInvoice.isKaccha ? (data.kacchaBalanceDue ?? data.balanceDue || 0) : (data.balanceDue || 0)),
    notes: data.notes,
    otherCharges: existingInvoice.isKaccha ? (data.kacchaCharges ? JSON.stringify(data.kacchaCharges) : null) : (data.otherCharges || null),`
  );

  fs.writeFileSync(file, content);
}

function patchFrontendSale() {
  const file = 'artifacts/accounting-app/src/pages/sales/invoice-form.tsx';
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    `kacchaBalanceDue,
      notes,
        items: computedItems,
        payments,
      kacchaPayments: kacchaPayRows.filter(r => Number(r.amount) > 0).map(r => ({ mode: r.mode, amount: Number(r.amount), reference: r.reference })),
      otherCharges: charges.length > 0 ? JSON.stringify(charges) : null,`,
    `kacchaBalanceDue,
      kacchaGrandTotal,
      kacchaSubtotal: computedItems.filter(i => enableDualLedger && !i.isTaxLiability).reduce((acc, item) => acc + (Number(item.quantity)*Number(item.rate)), 0),
      notes,
        items: computedItems,
        payments,
      kacchaPayments: kacchaPayRows.filter(r => Number(r.amount) > 0).map(r => ({ mode: r.mode, amount: Number(r.amount), reference: r.reference })),
      otherCharges: charges.length > 0 ? JSON.stringify(charges) : null,
      kacchaCharges: kacchaCharges.length > 0 ? kacchaCharges : null,`
  );
  fs.writeFileSync(file, content);
}

function patchFrontendPurchase() {
  const file = 'artifacts/accounting-app/src/pages/purchase/invoice-form.tsx';
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    `notes,
        items: computedItems,
        payments,
      otherCharges: charges.length > 0 ? JSON.stringify(charges) : null,`,
    `notes,
        items: computedItems,
        payments,
      kacchaGrandTotal,
      kacchaAmountPaid: 0,
      kacchaBalanceDue: kacchaGrandTotal,
      kacchaSubtotal: computedItems.filter(i => enableDualLedger && !i.isTaxLiability).reduce((acc, item) => acc + (Number(item.quantity)*Number(item.rate)), 0),
      otherCharges: charges.length > 0 ? JSON.stringify(charges) : null,
      kacchaCharges: kacchaCharges.length > 0 ? kacchaCharges : null,`
  );
  fs.writeFileSync(file, content);
}

patchSaleInvoices();
patchPurchaseInvoices();
patchFrontendSale();
patchFrontendPurchase();
console.log('Patched');
