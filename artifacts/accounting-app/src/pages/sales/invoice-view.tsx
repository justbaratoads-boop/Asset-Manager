import { useRoute, Link } from "wouter";
import { useGetSaleInvoice, useGetCompanySettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Printer, ArrowLeft } from "lucide-react";

export default function SaleInvoiceView() {
  const [, params] = useRoute("/sales/invoices/:id");
  const id = Number(params?.id);
  const { data: invoice, isLoading } = useGetSaleInvoice(id, { query: { enabled: !!id } });
  const { data: company } = useGetCompanySettings();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/sales/invoices">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        </Link>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </div>

      <div className="bg-white border rounded-xl p-8 max-w-3xl mx-auto" id="invoice-print">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-xl font-bold">{company?.companyName || "Company Name"}</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{company?.address}</p>
            {company?.gstin && <p className="text-sm">GSTIN: {company.gstin}</p>}
            {company?.phone && <p className="text-sm">{company.phone}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-primary">TAX INVOICE</h1>
            <p className="font-mono text-sm">#{invoice.invoiceNumber}</p>
            <p className="text-sm">{formatDate(invoice.date)}</p>
          </div>
        </div>

        <div className="border-t border-b py-4 mb-6">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Bill To</p>
          <p className="font-semibold">{invoice.partyName}</p>
          {invoice.partyGstin && <p className="text-sm">GSTIN: {invoice.partyGstin}</p>}
          {invoice.billingAddress && <p className="text-sm text-muted-foreground">{invoice.billingAddress}</p>}
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">#</th>
              <th className="text-left py-2 font-semibold">Item</th>
              <th className="text-left py-2 font-semibold">HSN</th>
              <th className="text-right py-2 font-semibold">Qty</th>
              <th className="text-right py-2 font-semibold">Rate</th>
              <th className="text-right py-2 font-semibold">Disc%</th>
              <th className="text-right py-2 font-semibold">GST%</th>
              <th className="text-right py-2 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice as any).items?.map((item: any, i: number) => (
              <tr key={i} className="border-b">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{item.itemName}</td>
                <td className="py-2 text-muted-foreground">{item.hsnCode}</td>
                <td className="py-2 text-right">{item.quantity} {item.unit}</td>
                <td className="py-2 text-right">{formatCurrency(item.rate)}</td>
                <td className="py-2 text-right">{item.discountPct}%</td>
                <td className="py-2 text-right">{item.gstPct}%</td>
                <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
            {Number(invoice.totalDiscount) > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(invoice.totalDiscount)}</span></div>}
            {Number(invoice.totalCgst) > 0 && <div className="flex justify-between"><span>CGST</span><span>{formatCurrency(invoice.totalCgst)}</span></div>}
            {Number(invoice.totalSgst) > 0 && <div className="flex justify-between"><span>SGST</span><span>{formatCurrency(invoice.totalSgst)}</span></div>}
            {Number(invoice.totalIgst) > 0 && <div className="flex justify-between"><span>IGST</span><span>{formatCurrency(invoice.totalIgst)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{formatCurrency(invoice.grandTotal)}</span></div>
            <div className="flex justify-between text-green-600"><span>Paid</span><span>{formatCurrency(invoice.amountPaid)}</span></div>
            {Number(invoice.balanceDue) > 0 && <div className="flex justify-between font-semibold text-red-600"><span>Balance Due</span><span>{formatCurrency(invoice.balanceDue)}</span></div>}
          </div>
        </div>

        {(invoice as any).payments?.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <p className="text-sm font-semibold mb-2">Payment Details</p>
            {(invoice as any).payments.map((p: any, i: number) => (
              <p key={i} className="text-sm text-muted-foreground capitalize">{p.mode}: {formatCurrency(p.amount)} {p.reference && `(Ref: ${p.reference})`}</p>
            ))}
          </div>
        )}

        {company?.billFooter && (
          <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground">{company.billFooter}</div>
        )}
      </div>

      <style>{`
        @media print {
          body > * { display: none; }
          #invoice-print { display: block !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
