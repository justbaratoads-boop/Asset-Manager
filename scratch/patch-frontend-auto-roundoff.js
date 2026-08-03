const fs = require('fs');
const files = [
  'artifacts/accounting-app/src/pages/sales/invoice-form.tsx',
  'artifacts/accounting-app/src/pages/purchase/invoice-form.tsx',
  'artifacts/accounting-app/src/pages/accounts/credit-note-form.tsx',
  'artifacts/accounting-app/src/pages/accounts/debit-note-form.tsx',
];

for (const file of files) {
  if (!fs.existsSync(file)) { console.log('not found', file); continue; }
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('autoRoundOff')) {
    content = content.replace(
      'const enableDualLedger = (companySettings as any)?.enableDualLedger ?? false;',
      'const enableDualLedger = (companySettings as any)?.enableDualLedger ?? false;\n  const autoRoundOff = (companySettings as any)?.autoRoundOff ?? false;'
    );
  }

  if (!content.includes('kacchaCharges')) {
    content = content.replace(
      'const [charges, setCharges] = useState<{ name: string, amount: string, type: string }[]>([]);',
      'const [charges, setCharges] = useState<{ name: string, amount: string, type: string }[]>([]);\n  const [kacchaCharges, setKacchaCharges] = useState<{ name: string, amount: string, type: string }[]>([]);'
    );
  }

  // add useEffect for autoRoundOff
  if (!content.includes('useEffect(() => {\n    if (!autoRoundOff) return;')) {
    const effectHook = `
  useEffect(() => {
    if (!autoRoundOff) return;
    const hasPakka = computedItems.some(i => enableDualLedger ? i.isTaxLiability : true);
    
    // Auto round off Pakka
    const rawPakka = computedItems.filter(i => enableDualLedger ? i.isTaxLiability : true).reduce((acc, item) => acc + item.total, 0);
    const pakkaTotalBeforeRoundOff = rawPakka + charges.filter(c => c.name !== "Round Off").reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0);
    const roundedPakka = Math.round(pakkaTotalBeforeRoundOff);
    const diffPakka = roundedPakka - pakkaTotalBeforeRoundOff;
    
    setCharges(prev => {
      const filtered = prev.filter(c => c.name !== "Round Off");
      if (Math.abs(diffPakka) > 0.001) {
        filtered.push({ name: "Round Off", amount: String(Math.abs(diffPakka).toFixed(2)), type: diffPakka > 0 ? "add" : "deduct" });
      }
      return JSON.stringify(prev) === JSON.stringify(filtered) ? prev : filtered;
    });

    if (enableDualLedger) {
      const rawKaccha = computedItems.filter(i => !i.isTaxLiability).reduce((acc, item) => acc + item.total, 0);
      const kacchaTotalBeforeRoundOff = rawKaccha + (!hasPakka ? charges.filter(c => c.name !== "Round Off").reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0) : 0);
      const roundedKaccha = Math.round(kacchaTotalBeforeRoundOff);
      const diffKaccha = roundedKaccha - kacchaTotalBeforeRoundOff;
      
      setKacchaCharges(prev => {
        const filtered = prev.filter(c => c.name !== "Round Off");
        if (Math.abs(diffKaccha) > 0.001) {
          filtered.push({ name: "Round Off", amount: String(Math.abs(diffKaccha).toFixed(2)), type: diffKaccha > 0 ? "add" : "deduct" });
        }
        return JSON.stringify(prev) === JSON.stringify(filtered) ? prev : filtered;
      });
    }
  }, [autoRoundOff, computedItems, enableDualLedger, charges]);
`;
    // Insert after charges definition
    content = content.replace(
      'const [kacchaCharges, setKacchaCharges] = useState<{ name: string, amount: string, type: string }[]>([]);',
      'const [kacchaCharges, setKacchaCharges] = useState<{ name: string, amount: string, type: string }[]>([]);\n' + effectHook
    );
  }

  // Update kacchaGrandTotal
  if (!content.includes('const kacchaChargesTotal = kacchaCharges')) {
    content = content.replace(
      'const kacchaGrandTotal = computedItems.filter(i => enableDualLedger && !i.isTaxLiability).reduce((acc, item) => acc + item.total, 0) + (!hasPakka ? chargesTotal : 0);',
      'const kacchaChargesTotal = kacchaCharges.reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0);\n    const kacchaGrandTotal = computedItems.filter(i => enableDualLedger && !i.isTaxLiability).reduce((acc, item) => acc + item.total, 0) + (!hasPakka ? chargesTotal : 0) + kacchaChargesTotal;'
    );
  }

  // Add KacchaCharges to UI
  if (content.includes('Kaccha Due')) {
    content = content.replace(
      '<div className="flex justify-between"><span className="text-muted-foreground">Kaccha Due</span><span className="font-semibold text-amber-600">{formatCurrency(kacchaAmountPaid)}</span></div>',
      '{kacchaChargesTotal !== 0 && <div className="flex justify-between text-muted-foreground"><span>Kaccha Additional</span><span className={kacchaChargesTotal < 0 ? "text-red-600" : ""}>{kacchaChargesTotal < 0 ? "- " : "+ "}{formatCurrency(Math.abs(kacchaChargesTotal))}</span></div>}\n                    <div className="flex justify-between"><span className="text-muted-foreground">Kaccha Due</span><span className="font-semibold text-amber-600">{formatCurrency(kacchaAmountPaid)}</span></div>'
    );
  }

  // Add kacchaCharges to mutate
  content = content.replace(
    'kacchaGrandTotal,',
    'kacchaGrandTotal, kacchaCharges: JSON.stringify(kacchaCharges),'
  );

  fs.writeFileSync(file, content);
}
console.log('done');
