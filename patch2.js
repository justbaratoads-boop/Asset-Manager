const fs = require("fs");
const filesToPatch = [
  {
    file: "artifacts/accounting-app/src/pages/purchase/invoice-list.tsx",
    replacements: [
      [/\{ search: search \|\| undefined \}/g, '({ search: search || undefined } as any)']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/sales/orders.tsx",
    replacements: [
      [/\{ search \}/g, '({ search } as any)']
    ]
  }
];

for (const {file, replacements} of filesToPatch) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    for (const [regex, replacement] of replacements) {
      content = content.replace(regex, replacement);
    }
    fs.writeFileSync(file, content);
    console.log("Patched", file);
  } catch (err) {
    console.log("Failed", file, err.message);
  }
}
