const fs = require('fs');
const path = require('path');

const salesListPath = path.resolve(__dirname, 'artifacts/accounting-app/src/pages/sales/invoice-list.tsx');
let content = fs.readFileSync(salesListPath, 'utf8');

// Ensure necessary imports are there
if (!content.includes('Sheet')) {
  content = content.replace(
    /import \{ Card, CardContent \} from "@\/components\/ui\/card";/,
    `import { Card, CardContent } from "@/components/ui/card";\nimport { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";\nimport { customFetch } from "@workspace/api-client-react";\nimport { useFetch } from "@/hooks/use-fetch";\nimport { FileText, Printer } from "lucide-react";`
  );
}

// Add itemBaseRate
if (!content.includes('function itemBaseRate')) {
  content = content.replace(
    /const PAGE_SIZE = 20;/,
    `/** Always returns the pre-GST base rate per unit, regardless of inclusive/exclusive. */
function itemBaseRate(item: any): number {
  const qty = Number(item.quantity) || 0;
  const discPct = Number(item.discountPct) || 0;
  const factor = 1 - discPct / 100;
  if (qty === 0 || factor === 0) return 0;
  return Number(item.taxableAmount) / qty / factor;
}

const PAGE_SIZE = 20;`
  );
}

// Add getBatchName
if (!content.includes('function getBatchName')) {
  content = content.replace(
    /function StatusBadge/,
    `function getBatchName(batchId: number | null | undefined, batches: any[]): string {
  if (!batchId) return "";
  const b = (batches || []).find((b: any) => b.id === Number(batchId));
  return b ? b.name + (b.expiryDate ? \` - exp \${b.expiryDate}\` : "") : \`#\${batchId}\`;
}

function StatusBadge`
  );
}

// Add the view sheet component before the default export
if (!content.includes('SaleInvoiceViewSheet')) {
  const sheetComponent = `
// ------------------------------------------------------------------------------------------------
// View Sheet
// ------------------------------------------------------------------------------------------------
function SaleInvoiceViewSheet({ id, onClose }: { id: number | null; onClose: () => void; }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastId, setLastId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) { setData(null); setLastId(null); return; }
    if (id === lastId) return;
    setLastId(id);
    setLoading(true);
    setData(null);
    customFetch<any>(\`/api/sale-invoices/\${id}\`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");
  const [bankAccounts, setBankAccounts] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    customFetch<any>("/api/ledgers?group=Bank%20Accounts").then((data: any) => {
      if (Array.isArray(data)) setBankAccounts(data.map((l: any) => ({ value: \`bank_\${l.id}\`, label: l.name })));
    }).catch(() => {});
  }, []);
  const allPaymentModes = [{ value: "cash", label: "Cash" }, ...bankAccounts];
  const items: any[] = data?.items || [];
  const payments: any[] = data?.payments || [];

  return (
    <Sheet open={!!id} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Sale Invoice
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
        ) : !data ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Not found</div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* Header info */}
            <div className="rounded-lg border bg-muted/30 divide-y">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Invoice #</span>
                <span className="font-mono font-semibold text-sm">{data.invoiceNumber}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Date</span>
                <span className="text-sm font-medium">{formatDate(data.date)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Customer</span>
                <span className="text-sm font-semibold">{data.partyName}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
                <StatusBadge status={data.status} />
              </div>
              {data.notes && (
                <div className="px-4 py-2.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm">{data.notes}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Item</th>
                      <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground">Rate</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{item.itemName}</p>
                          {item.batchId && <p className="text-xs text-blue-600 font-medium">{getBatchName(item.batchId, batches)}</p>}
                          {Number(item.gstPct) > 0 && <p className="text-xs text-muted-foreground">GST {item.gstPct}%</p>}
                        </td>
                        <td className="px-2 py-2.5 text-right text-muted-foreground whitespace-nowrap">{Number(item.quantity)} {item.unit}</td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap">{formatCurrency(itemBaseRate(item))}</td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-lg border bg-muted/30 divide-y text-sm">
              {Number(data.totalTaxable) > 0 && (
                <div className="flex justify-between px-4 py-2">
                  <span className="text-muted-foreground">Taxable</span>
                  <span>{formatCurrency(Number(data.totalTaxable))}</span>
                </div>
              )}
              {Number(data.totalCgst) > 0 && (
                <div className="flex justify-between px-4 py-2">
                  <span className="text-muted-foreground">CGST</span>
                  <span>+ {formatCurrency(Number(data.totalCgst))}</span>
                </div>
              )}
              {Number(data.totalSgst) > 0 && (
                <div className="flex justify-between px-4 py-2">
                  <span className="text-muted-foreground">SGST</span>
                  <span>+ {formatCurrency(Number(data.totalSgst))}</span>
                </div>
              )}
              {Number(data.totalIgst) > 0 && (
                <div className="flex justify-between px-4 py-2">
                  <span className="text-muted-foreground">IGST</span>
                  <span>+ {formatCurrency(Number(data.totalIgst))}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5 font-bold text-base">
                <span>Grand Total</span>
                <span>{formatCurrency(Number(data.grandTotal))}</span>
              </div>
              <div className="flex justify-between px-4 py-2 text-green-700">
                <span>Amount Paid</span>
                <span className="font-semibold">{formatCurrency(Number(data.amountPaid))}</span>
              </div>
              <div className="flex justify-between px-4 py-2 font-bold text-red-700">
                <span>Balance Due</span>
                <span>{formatCurrency(Number(data.balanceDue))}</span>
              </div>
            </div>

            {/* Payment history */}
            {payments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment History</p>
                <div className="rounded-lg border divide-y">
                  {payments.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                      <div>
                        <span className="font-medium capitalize">{allPaymentModes.find(m => m.value === p.mode)?.label ?? p.mode?.replace(/_/g, " ") ?? ""}</span>
                        {p.reference && <span className="text-xs text-muted-foreground ml-2">Ref: {p.reference}</span>}
                      </div>
                      <span className="font-semibold text-green-700">{formatCurrency(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
              <Link href={\`/sales/invoices/\${data.id}?print=1\`} className="flex-1">
                <Button variant="outline" className="w-full gap-2"><Printer className="h-4 w-4" />Print</Button>
              </Link>
              <Link href={\`/sales/invoices/\${data.id}/edit\`} className="flex-1">
                <Button className="w-full gap-2"><Pencil className="h-4 w-4" />Edit</Button>
              </Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SaleInvoiceList`;

  content = content.replace(/export default function SaleInvoiceList/, sheetComponent);
}

// Add state to the main component
if (!content.includes('const [viewId, setViewId] = useState<number | null>(null);')) {
  content = content.replace(
    /const \[deleteId, setDeleteId\] = useState<number \| null>\(null\);/,
    `const [deleteId, setDeleteId] = useState<number | null>(null);\n  const [viewId, setViewId] = useState<number | null>(null);`
  );
}

// Update View buttons to setViewId instead of Link
content = content.replace(
  /<Link href=\{\`\/sales\/invoices\/\$\{inv\.id\}\`\} className="flex-1">\s*<Button size="sm" variant="outline" className="w-full"><Eye className="h-3\.5 w-3\.5 mr-1" \/>View<\/Button>\s*<\/Link>/g,
  `<Button size="sm" variant="outline" className="flex-1" onClick={() => setViewId(inv.id)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>`
);

content = content.replace(
  /<Link href=\{\`\/sales\/invoices\/\$\{inv\.id\}\`\}><Button size="icon" variant="ghost" className="h-7 w-7"><Eye className="h-3\.5 w-3\.5" \/><\/Button><\/Link>/g,
  `<Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(inv.id)}><Eye className="h-3.5 w-3.5" /></Button>`
);

// Add row click to open view sheet
content = content.replace(
  /<TableRow key=\{inv\.id\}>/g,
  `<TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewId(inv.id)}>`
);

// Make row buttons not trigger row click
content = content.replace(
  /<TableCell>\s*<div className="flex gap-1">/g,
  `<TableCell onClick={e => e.stopPropagation()}>\n                    <div className="flex gap-1 justify-end">`
);

// Add the view sheet to the bottom of the JSX
if (!content.includes('<SaleInvoiceViewSheet')) {
  content = content.replace(
    /<\/div>\s*\);\s*}\s*$/,
    `\n      <SaleInvoiceViewSheet id={viewId} onClose={() => setViewId(null)} />\n    </div>\n  );\n}\n`
  );
}

fs.writeFileSync(salesListPath, content);
console.log('Patched sales/invoice-list.tsx');
