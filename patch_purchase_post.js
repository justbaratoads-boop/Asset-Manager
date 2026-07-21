const fs = require('fs');
let f = fs.readFileSync('artifacts/api-server/src/routes/purchase.ts', 'utf8');

// Also need to import makeKacchaInvoiceNumber and companySettingsTable if not present
if (!f.includes('companySettingsTable')) {
  f = f.replace(
    'purchaseOrdersTable, purchaseOrderItemsTable, stockTransactionsTable',
    'purchaseOrdersTable, purchaseOrderItemsTable, stockTransactionsTable, companySettingsTable'
  );
}
if (!f.includes('makeKacchaInvoiceNumber')) {
  f = f.replace(
    'makeInvoiceNumber, makeVoucherNumber',
    'makeInvoiceNumber, makeKacchaInvoiceNumber, makeVoucherNumber'
  );
}

const postStart = f.indexOf('router.post("/purchase-invoices", authMiddleware, async (req, res) => {');
const getStart = f.indexOf('router.get("/purchase-invoices/:id", authMiddleware, async (req, res) => {');

const newPost = `router.post("/purchase-invoices", authMiddleware, async (req, res) => {
  const data = req.body;

  const settings = await db.select().from(companySettingsTable).limit(1);
  const enableDualLedger = settings[0]?.enableDualLedger === "true" || settings[0]?.enableDualLedger === true;
  const prefix = settings[0]?.purchasePrefix || "PUR";
  const kacchaPrefix = settings[0]?.kacchaPurchasePrefix || "KPUR";
  const reqDate = new Date(data.date || Date.now());
  const finStartMonth = settings[0]?.financialYearStart || 4;
  const finYearNum = (reqDate.getMonth() + 1) >= finStartMonth ? reqDate.getFullYear() : reqDate.getFullYear() - 1;
  const finYear = String(finYearNum);

  let kacchaItems = [];
  let pakkaItems = [];

  if (enableDualLedger && data.items?.length) {
    kacchaItems = data.items.filter((i: any) => i.isTaxLiability === false);
    pakkaItems = data.items.filter((i: any) => i.isTaxLiability !== false);
  } else {
    pakkaItems = data.items || [];
  }

  async function createInvoicePart(itemsToSave: any[], isKaccha: boolean, paymentsToSave: any[], partAmountPaid: number, partBalanceDue: number, partGrandTotal: number) {
    const invNum = isKaccha ? await makeKacchaInvoiceNumber(kacchaPrefix, finYear) : await makeInvoiceNumber(prefix);
    const sub = itemsToSave.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const base = itemsToSave.reduce((s, i) => s + Number(i.taxableAmount || 0), 0);
    const cgst = itemsToSave.reduce((s, i) => s + Number(i.cgst || 0), 0);
    const sgst = itemsToSave.reduce((s, i) => s + Number(i.sgst || 0), 0);
    const igst = itemsToSave.reduce((s, i) => s + Number(i.igst || 0), 0);
    const totGst = cgst + sgst + igst;

    let otherChargesParsed = 0;
    if (!isKaccha && data.otherCharges) {
      try {
        const charges = JSON.parse(data.otherCharges);
        otherChargesParsed = charges.reduce((s: number, c: any) => s + ((c.type ?? "add") === "deduct" ? -Number(c.amount) : Number(c.amount)), 0);
      } catch (e) {}
    }
    const gTotal = partGrandTotal ?? (base + totGst + otherChargesParsed);

    const [inv] = await db.insert(purchaseInvoicesTable).values({
      invoiceNumber: invNum,
      supplierInvoiceNumber: data.supplierInvoiceNumber,
      date: data.date,
      partyId: data.partyId,
      partyName: data.partyName,
      isGst: isKaccha ? false : (data.isGst ?? true),
      isInterstate: data.isInterstate ?? false,
      isReverseCharge: isKaccha ? false : (data.isReverseCharge ?? false),
      isKaccha: isKaccha,
      subtotal: String(sub),
      totalTaxable: String(base),
      totalCgst: String(cgst),
      totalSgst: String(sgst),
      totalIgst: String(igst),
      grandTotal: String(gTotal),
      amountPaid: String(partAmountPaid || 0),
      balanceDue: String(partBalanceDue || 0),
      notes: data.notes,
      otherCharges: isKaccha ? null : (data.otherCharges || null),
    }).returning();

    for (const item of itemsToSave) {
      await db.insert(purchaseInvoiceItemsTable).values({
        invoiceId: inv.id,
        stockItemId: item.stockItemId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        quantity: String(item.quantity || 0),
        unit: item.unit,
        rate: String(item.rate || 0),
        discountPct: String(item.discountPct || 0),
        gstPct: String(isKaccha ? 0 : (item.gstPct || 0)),
        taxableAmount: String(item.taxableAmount || 0),
        cgst: String(isKaccha ? 0 : (item.cgst || 0)),
        sgst: String(isKaccha ? 0 : (item.sgst || 0)),
        igst: String(isKaccha ? 0 : (item.igst || 0)),
        batchId: item.batchId || null,
        total: String(item.total || 0),
      });

      if (item.stockItemId) {
        const newBalance = await adjustStock(item.stockItemId, item.batchId || null, Number(item.quantity));
        await db.insert(stockTransactionsTable).values({
          itemId: item.stockItemId,
          batchId: item.batchId || null,
          type: "purchase",
          quantity: String(item.quantity),
          balanceAfter: String(newBalance),
          reference: invNum,
          isKaccha: isKaccha,
        } as any);
      }
    }

    if (paymentsToSave?.length) {
      for (const payment of paymentsToSave) {
        await db.insert(purchaseInvoicePaymentsTable).values({
          invoiceId: inv.id,
          mode: payment.mode,
          amount: String(payment.amount),
          reference: payment.reference,
        });
      }
    }

    return inv;
  }

  let finalInvoice = null;

  if (kacchaItems.length > 0) {
    const kacchaGrandTotalCalc = data.kacchaGrandTotal ?? kacchaItems.reduce((s: number, i: any) => s + Number(i.total), 0);
    const kInv = await createInvoicePart(kacchaItems, true, data.kacchaPayments || [], data.kacchaAmountPaid, data.kacchaBalanceDue, kacchaGrandTotalCalc);
    if (!finalInvoice) finalInvoice = kInv;
  }
  
  if (pakkaItems.length > 0) {
    const pInv = await createInvoicePart(pakkaItems, false, data.payments || [], data.amountPaid, data.balanceDue, data.pakkaGrandTotal ?? data.grandTotal);
    finalInvoice = pInv;
  }

  res.status(201).json(finalInvoice || {});
});
`;

f = f.substring(0, postStart) + newPost + f.substring(getStart);
fs.writeFileSync('artifacts/api-server/src/routes/purchase.ts', f);
