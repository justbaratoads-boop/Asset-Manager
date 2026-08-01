export function getGstRateForDate(item: any, invoiceDateStr: string): number {
  if (!item) return 0;
  
  // If there's no history or it's not an array, just use the current gstRate
  if (!Array.isArray(item.gstHistory) || item.gstHistory.length === 0) {
    return Number(item.gstRate) || 0;
  }

  // Sort history by effective date descending (newest first)
  const sortedHistory = [...item.gstHistory].sort((a: any, b: any) => {
    const dateA = a.effectiveFrom || a.changedAt;
    const dateB = b.effectiveFrom || b.changedAt;
    return dateA < dateB ? 1 : (dateA > dateB ? -1 : 0);
  });

  // Start with the current rate
  let activeRate = Number(item.gstRate) || 0;

  // We are going backwards in time.
  // The first (newest) change record tells us what the rate changed FROM (oldRate) 
  // on its effective date.
  for (const log of sortedHistory) {
    const effective = log.effectiveFrom || log.changedAt;
    // If the invoice date is strictly BEFORE the effective date of this change,
    // it means this change wasn't active yet, so the active rate was the OLD rate.
    // We update activeRate to oldRate and continue moving backwards in time.
    if (invoiceDateStr < effective) {
      activeRate = Number(log.oldRate) || 0;
    } else {
      // If the invoice date is >= the effective date, this change WAS active.
      // Since we are going backwards in time from newest to oldest, 
      // the first change we hit where invoiceDate >= effectiveDate is the correct active era.
      break;
    }
  }

  return activeRate;
}


export interface CalculateItemArgs {
  quantity: number;
  rate: number;
  discountPct?: number;
  gstPct: number;
  gstInclusive?: boolean;
  apportionedChargeAmount?: number; // amount of assessable charge assigned to this item
}

export function computeItem(args: CalculateItemArgs, isInterstate: boolean) {
  const qty = Number(args.quantity) || 0;
  const rate = Number(args.rate) || 0;
  const discPct = Number(args.discountPct) || 0;
  const gstPct = Number(args.gstPct) || 0;
  const apportioned = Number(args.apportionedChargeAmount) || 0;

  const subtotal = qty * rate;
  const discountAmount = (subtotal * discPct) / 100;
  let baseAmount = subtotal - discountAmount;
  let taxableAmount = baseAmount + apportioned;

  if (args.gstInclusive && gstPct > 0) {
    taxableAmount = taxableAmount / (1 + gstPct / 100);
    baseAmount = taxableAmount - apportioned;
  }

  const totalGst = (taxableAmount * gstPct) / 100;
  const cgst = isInterstate ? 0 : totalGst / 2;
  const sgst = isInterstate ? 0 : totalGst / 2;
  const igst = isInterstate ? totalGst : 0;
  const total = taxableAmount + totalGst;

  return { subtotal, discountAmount, baseAmount, taxableAmount, totalGst, cgst, sgst, igst, total };
}

export function computeInvoice(items: any[], charges: any[], isInterstate: boolean, isKaccha: boolean = false) {
  let subtotal = 0;
  let discount = 0;
  let totalTaxable = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  
  // 1. Calculate assessable charges
  const assessableCharges = charges.filter(c => c.gstCalculationMethod === 'assessable_value');
  const totalAssessableAmount = assessableCharges.reduce((sum, c) => sum + (c.type === 'deduct' ? -Number(c.amount) : Number(c.amount)), 0);

  // 2. Distribute assessable charges
  const totalItemValue = items.reduce((sum, i) => {
    const qty = Number(i.quantity) || 0;
    const rate = Number(i.rate) || 0;
    const disc = Number(i.discountPct) || 0;
    return sum + (qty * rate) * (1 - disc / 100);
  }, 0);

  const finalItems = items.map(item => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const disc = Number(item.discountPct) || 0;
    const itemVal = (qty * rate) * (1 - disc / 100);
    const apportioned = totalItemValue > 0 ? (itemVal / totalItemValue) * totalAssessableAmount : 0;
    
    if (isKaccha || item.isTaxLiability === false) {
      const sub = qty * rate;
      const discAmt = sub * (disc / 100);
      return { ...item, subtotal: sub, totalDiscount: discAmt, taxableAmount: sub - discAmt, totalGst: 0, cgst: 0, sgst: 0, igst: 0, total: sub - discAmt };
    }

    const computed = computeItem({
      quantity: qty,
      rate: rate,
      discountPct: disc,
      gstPct: Number(item.gstPct) || 0,
      gstInclusive: item.gstInclusive,
      apportionedChargeAmount: apportioned
    }, isInterstate);

    const rSub = Number(computed.subtotal.toFixed(2));
    const rDisc = Number(computed.discountAmount.toFixed(2));
    const rTaxable = Number(computed.taxableAmount.toFixed(2));
    const rCgst = Number(computed.cgst.toFixed(2));
    const rSgst = Number(computed.sgst.toFixed(2));
    const rIgst = Number(computed.igst.toFixed(2));
    const rTotalGst = Number((rCgst + rSgst + rIgst).toFixed(2));
    const rTotal = Number((rTaxable + rTotalGst).toFixed(2));

    subtotal += rSub;
    discount += rDisc;
    totalTaxable += rTaxable;
    cgst += rCgst;
    sgst += rSgst;
    igst += rIgst;

    return {
      ...item,
      subtotal: rSub,
      totalDiscount: rDisc,
      taxableAmount: rTaxable,
      totalGst: rTotalGst,
      cgst: rCgst,
      sgst: rSgst,
      igst: rIgst,
      total: rTotal
    };
  });

  // 3. Flat rate charges
  const flatCharges = charges.filter(c => c.gstCalculationMethod === 'flat_rate');
  let chargesTotal = 0;

  for (const c of charges) {
    const amt = c.type === 'deduct' ? -Number(c.amount) : Number(c.amount);
    chargesTotal += amt;
  }

  if (!isKaccha) {
    for (const c of flatCharges) {
      const amt = c.type === 'deduct' ? -Number(c.amount) : Number(c.amount);
      const rate = Number(c.gstRate) || 0;
      const tax = (amt * rate) / 100;
      if (isInterstate) {
        igst += tax;
      } else {
        cgst += tax / 2;
        sgst += tax / 2;
      }
    }
  }

  const tCgst = Number(cgst.toFixed(2));
  const tSgst = Number(sgst.toFixed(2));
  const tIgst = Number(igst.toFixed(2));
  const tTaxable = Number(totalTaxable.toFixed(2));
  const tCharges = Number(chargesTotal.toFixed(2));
  const tAssessable = Number(totalAssessableAmount.toFixed(2));

  const grand = Number((tTaxable + tCgst + tSgst + tIgst + tCharges - tAssessable).toFixed(2));

  return {
    items: finalItems,
    totals: {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      taxable: tTaxable,
      gst: Number((tCgst + tSgst + tIgst).toFixed(2)),
      cgst: tCgst,
      sgst: tSgst,
      igst: tIgst,
      grand,
      chargesTotal: tCharges
    }
  };
}
