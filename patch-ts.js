const fs = require("fs");
const path = require("path");

const filesToPatch = [
  {
    file: "artifacts/accounting-app/src/pages/accounts/ledger-statement.tsx",
    replacements: [
      [/const \[match, params\] = useRoute\("\/accounts\/ledgers\/:id\/statement"\);/g, 'const [match, params] = useRoute("/accounts/ledgers/:id/statement");\n  const { globalFrom: from, globalTo: to, setGlobalFrom: setFrom, setGlobalTo: setTo } = useFY();'],
      [/import { ArrowLeft } from "lucide-react";/g, 'import { ArrowLeft } from "lucide-react";\nimport { useFY } from "@/lib/financial-year";']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/accounts/party-ledger.tsx",
    replacements: [
      [/const { data: party, isLoading: partyLoading } = useGetParty\(/g, 'const { data: party, isLoading: partyLoading } = useGetParty(Number(params?.id), { query: { enabled: !!params?.id } }); //'],
      [/const { data: statement, isLoading: statementLoading } = useGetPartyStatement\(/g, 'const { data: statement, isLoading: statementLoading } = useGetPartyStatement({ partyId: Number(params?.id) }, { query: { enabled: !!params?.id } }); //']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/accounts/payment-form.tsx",
    replacements: [
      [/const { data: payment, isLoading } = useGetPayment\(/g, 'const { data: payment, isLoading } = useGetPayment(Number(params?.id), { query: { enabled: !!params?.id } }); //']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/accounts/receipt-form.tsx",
    replacements: [
      [/const { data: receipt, isLoading } = useGetReceipt\(/g, 'const { data: receipt, isLoading } = useGetReceipt(Number(params?.id), { query: { enabled: !!params?.id } }); //']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/gst/index.tsx",
    replacements: [
      [/let from = searchParams.get\("from"\);/g, 'let from = searchParams.get("from") || undefined;'],
      [/let to = searchParams.get\("to"\);/g, 'let to = searchParams.get("to") || undefined;']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/inventory/batches.tsx",
    replacements: [
      [/<XCircle className="h-5 w-5" title="Expired" \/>/g, '<XCircle className="h-5 w-5" />']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/inventory/item-detail.tsx",
    replacements: [
      [/const { data: item, isLoading } = useGetStockItem\(Number\(params.id\)\);/g, 'const { data: item, isLoading } = useGetStockItem(Number(params.id), { query: { enabled: !!params.id } });'],
      [/const { data: txs = \[\], isLoading: txsLoading } = useGetStockItemTransactions\(Number\(params.id\)\);/g, 'const { data: txs = [], isLoading: txsLoading } = useGetStockItemTransactions(Number(params.id), { query: { enabled: !!params.id } });']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/inventory/item-form.tsx",
    replacements: [
      [/const { data: existing, isLoading } = useGetStockItem\(editId\);/g, 'const { data: existing, isLoading } = useGetStockItem(editId, { query: { enabled: !!editId } });']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/purchase/invoice-form.tsx",
    replacements: [
      [/const { data: invoice, isLoading } = useGetPurchaseInvoice\(editId\);/g, 'const { data: invoice, isLoading } = useGetPurchaseInvoice(editId, { query: { enabled: !!editId } });'],
      [/setOtherCharges\(prev => \[\.\.\.prev, \{ name: "", amount: "", type: "add" \}\]\)/g, 'setOtherCharges(prev => [...prev, { name: "", amount: "", type: "add" as const, ledgerId: 0, ledgerName: "" }])']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/purchase/invoice-list.tsx",
    replacements: [
      [/search/g, 'search: search as any']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/purchase/order-form.tsx",
    replacements: [
      [/const { data: existing, isLoading } = useGetPurchaseOrder\(editId\);/g, 'const { data: existing, isLoading } = useGetPurchaseOrder(editId, { query: { enabled: !!editId } });']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/reports/balance-sheet.tsx",
    replacements: [
      [/useGetBalanceSheet\(\)/g, 'useGetBalanceSheet({})']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/reports/party-statement.tsx",
    replacements: [
      [/partyId: partyId \|\| undefined/g, 'partyId: partyId ? Number(partyId) : undefined']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/reports/stock-item-wise.tsx",
    replacements: [
      [/const { data: item, isLoading } = useGetStockItem\(Number\(id\)\);/g, 'const { data: item, isLoading } = useGetStockItem(Number(id), { query: { enabled: !!id } });'],
      [/\(item as any\)\.transactions/g, '((item as any)?.transactions || [])'],
      [/t.date/g, '(t as any).date'],
      [/\(item as any\)\.currentStock/g, '((item as any)?.physicalStock || 0)'],
      [/\(item as any\)\.purchasePrice/g, '((item as any)?.purchaseRate || 0)'],
      [/\(item as any\)\.salesPrice/g, '((item as any)?.saleRate || 0)']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/reports/trial-balance.tsx",
    replacements: [
      [/useGetTrialBalance\(\)/g, 'useGetTrialBalance({})']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/sales/invoice-form.tsx",
    replacements: [
      [/const { data: invoice, isLoading } = useGetSaleInvoice\(editId\);/g, 'const { data: invoice, isLoading } = useGetSaleInvoice(editId, { query: { enabled: !!editId } });'],
      [/setOtherCharges\(prev => \[\.\.\.prev, \{ name: "", amount: "", type: "add" \}\]\)/g, 'setOtherCharges(prev => [...prev, { name: "", amount: "", type: "add" as const, ledgerId: 0, ledgerName: "" }])']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/sales/invoice-view.tsx",
    replacements: [
      [/const { data: invoice, isLoading } = useGetSaleInvoice\(Number\(params.id\)\);/g, 'const { data: invoice, isLoading } = useGetSaleInvoice(Number(params.id), { query: { enabled: !!params.id } });'],
      [/setLocation\(-1\)/g, 'setLocation("/")']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/sales/order-form.tsx",
    replacements: [
      [/const { data: existing, isLoading } = useGetOrder\(editId\);/g, 'const { data: existing, isLoading } = useGetOrder(editId, { query: { enabled: !!editId } });']
    ]
  },
  {
    file: "artifacts/accounting-app/src/pages/sales/orders.tsx",
    replacements: [
      [/search: search/g, 'search: search as any']
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
