function test() {
  for (let isTax of [true, false, undefined, "true", "false"]) {
    for (let enableDualLedger of [true, false]) {
      const items = [{ isTaxLiability: isTax, total: 1181.91 }];
      const chargesTotal = 623.00;
      const amountPaid = 665.00;
      
      const isKaccha = enableDualLedger ? !items.some(i => i.isTaxLiability) : false;
      
      const tTaxable = isKaccha || items[0].isTaxLiability === false ? 0 : 1181.91;
      const cTotals_grand = tTaxable + chargesTotal;
      const cTotals_chargesTotal = chargesTotal;
      const totals_grand = cTotals_grand - cTotals_chargesTotal;
      const grandTotal = totals_grand + chargesTotal;
      
      const computedItems = [{ ...items[0], isTaxLiability: items[0].isTaxLiability, total: 1181.91 }];
      const hasPakka = computedItems.some(i => enableDualLedger ? i.isTaxLiability : true);
      const pakkaGrandTotal = computedItems.filter(i => enableDualLedger ? i.isTaxLiability : true).reduce((s, i) => s + i.total, 0) + (hasPakka ? chargesTotal : 0);
      const balanceDue = pakkaGrandTotal - amountPaid;
      
      if (grandTotal === 623 && balanceDue === 1139.91) {
        console.log("MATCH FOUND!", { isTax, enableDualLedger });
      }
    }
  }
}
test();
