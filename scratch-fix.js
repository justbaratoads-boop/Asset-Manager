const fs = require('fs');
const file = 'artifacts/accounting-app/src/pages/purchase/invoice-form.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("  useEffect(() => {\n    useEffect(() => {\n      if (!autoRoundOff) return;", "  useEffect(() => {\n      if (!autoRoundOff) return;");
fs.writeFileSync(file, content);
