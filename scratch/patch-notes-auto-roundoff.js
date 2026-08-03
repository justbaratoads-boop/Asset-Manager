const fs = require('fs');
const files = [
  'artifacts/accounting-app/src/pages/accounts/credit-note-form.tsx',
  'artifacts/accounting-app/src/pages/accounts/debit-note-form.tsx',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('autoRoundOff')) {
    content = content.replace(
      'const { data: companySettings } = useGetCompanySettings();',
      'const { data: companySettings } = useGetCompanySettings();\n  const autoRoundOff = (companySettings as any)?.autoRoundOff ?? false;'
    );
  }

  // add useEffect for autoRoundOff
  if (!content.includes('useEffect(() => {\n    if (!autoRoundOff) return;')) {
    const effectHook = `
  useEffect(() => {
    if (!autoRoundOff) return;
    
    // Auto round off 
    const rawTotal = computedItems.reduce((acc, item) => acc + item.total, 0);
    const totalBeforeRoundOff = rawTotal + charges.filter(c => c.name !== "Round Off").reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0);
    const rounded = Math.round(totalBeforeRoundOff);
    const diff = rounded - totalBeforeRoundOff;
    
    setCharges(prev => {
      const filtered = prev.filter(c => c.name !== "Round Off");
      if (Math.abs(diff) > 0.001) {
        filtered.push({ name: "Round Off", amount: String(Math.abs(diff).toFixed(2)), type: diff > 0 ? "add" : "deduct" });
      }
      return JSON.stringify(prev) === JSON.stringify(filtered) ? prev : filtered;
    });

  }, [autoRoundOff, computedItems, charges]);
`;
    // Insert after charges definition
    content = content.replace(
      'const [charges, setCharges] = useState<{ name: string, amount: string, type: string }[]>([]);',
      'const [charges, setCharges] = useState<{ name: string, amount: string, type: string }[]>([]);\n' + effectHook
    );
  }

  fs.writeFileSync(file, content);
}
console.log('done notes');
