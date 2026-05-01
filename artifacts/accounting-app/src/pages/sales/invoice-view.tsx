import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetSaleInvoice, useGetCompanySettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { Printer, ArrowLeft, Copy } from "lucide-react";

const PRINT_SETTINGS_KEY = "print_settings";

function loadPrintSettings() {
  try { return JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY) || "{}"); }
  catch { return {}; }
}

function InvoiceDocument({ invoice, company, copyLabel }: { invoice: any; company: any; copyLabel?: string }) {
  const ps = loadPrintSettings();
  const billTitle = ps.billTitle || "TAX INVOICE";
  const showLogo = ps.showLogo !== false;
  const showGstin = ps.showGstin !== false;
  const showPartyGstin = ps.showPartyGstin !== false;
  const showHsnCode = ps.showHsnCode !== false;
  const showBankDetails = ps.showBankDetails !== false;
  const showSignatureLine = ps.showSignatureLine !== false;
  const showFooter = ps.showFooter !== false;
  const showAddress = ps.showAddress !== false;
  const termsAndConditions = ps.termsAndConditions || "";

  return (
    <div className="bg-white border rounded-xl p-8 max-w-3xl mx-auto text-black" id="invoice-print">
      {copyLabel && (
        <div className="text-right text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">{copyLabel}</div>
      )}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-start gap-3">
          {showLogo && company?.logoUrl && (
            <img src={company.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
          )}
          <div>
            <h2 className="text-xl font-bold">{company?.companyName || company?.name || "Company Name"}</h2>
            {showAddress && <p className="text-sm text-gray-600 whitespace-pre-line">{company?.address}{company?.city ? `, ${company.city}` : ""}{company?.state ? `, ${company.state}` : ""}{company?.pincode ? ` - ${company.pincode}` : ""}</p>}
            {showGstin && company?.gstin && <p className="text-sm">GSTIN: {company.gstin}</p>}
            {company?.phone && <p className="text-sm">{company.phone}</p>}
            {company?.email && <p className="text-sm">{company.email}</p>}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-primary">{billTitle}</h1>
          <p className="font-mono text-sm">#{invoice.invoiceNumber}</p>
          <p className="text-sm">{formatDate(invoice.date)}</p>
        </div>
      </div>

      <div className="border-t border-b py-4 mb-6">
        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Bill To</p>
        <p className="font-semibold">{invoice.partyName}</p>
        {showPartyGstin && invoice.partyGstin && <p className="text-sm">GSTIN: {invoice.partyGstin}</p>}
        {invoice.billingAddress && <p className="text-sm text-gray-600">{invoice.billingAddress}</p>}
      </div>

      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">#</th>
            <th className="text-left py-2 font-semibold">Item</th>
            {showHsnCode && <th className="text-left py-2 font-semibold">HSN</th>}
            <th className="text-right py-2 font-semibold">Qty</th>
            <th className="text-right py-2 font-semibold">Rate</th>
            <th className="text-right py-2 font-semibold">Disc%</th>
            <th className="text-right py-2 font-semibold">GST%</th>
            <th className="text-right py-2 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item: any, i: number) => (
            <tr key={i} className="border-b">
              <td className="py-2">{i + 1}</td>
              <td className="py-2">{item.itemName}</td>
              {showHsnCode && <td className="py-2 text-gray-500">{item.hsnCode}</td>}
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

      {invoice.payments?.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-semibold mb-2">Payment Details</p>
          {invoice.payments.map((p: any, i: number) => (
            <p key={i} className="text-sm text-gray-500 capitalize">{p.mode}: {formatCurrency(p.amount)} {p.reference && `(Ref: ${p.reference})`}</p>
          ))}
        </div>
      )}

      {showBankDetails && company?.bankAccount && (
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-semibold mb-1">Bank Details</p>
          <p className="text-sm text-gray-600">{company.bankName} — A/C: {company.bankAccount}</p>
          {company.bankIfsc && <p className="text-sm text-gray-600">IFSC: {company.bankIfsc}{company.bankBranch ? ` | Branch: ${company.bankBranch}` : ""}</p>}
        </div>
      )}

      {termsAndConditions && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-semibold text-gray-500 mb-1">Terms & Conditions</p>
          <p className="text-xs text-gray-500 whitespace-pre-line">{termsAndConditions}</p>
        </div>
      )}

      {showSignatureLine && (
        <div className="mt-8 flex justify-between text-sm text-gray-500">
          <div className="text-center">
            <div className="border-t border-gray-400 mt-8 pt-1 w-36">Customer Signature</div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 mt-8 pt-1 w-48">For {company?.companyName || company?.name || ""}<br />Authorised Signatory</div>
          </div>
        </div>
      )}

      {showFooter && company?.billFooter && (
        <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">{company.billFooter}</div>
      )}
    </div>
  );
}

export default function SaleInvoiceView() {
  const [, params] = useRoute("/sales/invoices/:id");
  const [, search] = useLocation();
  const id = Number(params?.id);
  const { data: invoice, isLoading } = useGetSaleInvoice(id, { query: { enabled: !!id } });
  const { data: company } = useGetCompanySettings();

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [copies, setCopies] = useState("1");
  const ps = loadPrintSettings();
  const defaultCopies = ps.invoiceCopies || "1";
  const copyLabelsStr = ps.copyLabels || "Original, Duplicate, Triplicate";
  const copyLabels = copyLabelsStr.split(",").map((s: string) => s.trim());

  useEffect(() => {
    if (new URLSearchParams(search?.split("?")[1]).get("print") === "1") {
      setPrintDialogOpen(true);
    }
  }, [search]);

  const handlePrint = () => {
    const numCopies = Number(copies);
    const elements = [];
    for (let i = 0; i < numCopies; i++) {
      elements.push(`<div class="copy" style="${i > 0 ? "page-break-before:always;" : ""}">`);
      if (numCopies > 1) {
        elements.push(`<div style="text-align:right;font-size:11px;font-weight:600;color:#999;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">${copyLabels[i] || `Copy ${i + 1}`}</div>`);
      }
      elements.push(document.getElementById("invoice-print")?.innerHTML || "");
      elements.push(`</div>`);
    }
    const html = `<!DOCTYPE html><html><head><title>Invoice ${(invoice as any)?.invoiceNumber}</title><style>body{font-family:sans-serif;font-size:13px;padding:16px;color:#000}table{border-collapse:collapse;width:100%}@media print{.no-print{display:none}}</style></head><body>${elements.join("")}</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
    setPrintDialogOpen(false);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/sales/invoices">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setCopies("2"); setPrintDialogOpen(true); }}>
            <Copy className="h-4 w-4 mr-2" />Print 2nd Copy
          </Button>
          <Button onClick={() => { setCopies(defaultCopies); setPrintDialogOpen(true); }}>
            <Printer className="h-4 w-4 mr-2" />Print
          </Button>
        </div>
      </div>

      <InvoiceDocument invoice={invoice as any} company={company as any} />

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Print Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Number of Copies</Label>
              <Select value={copies} onValueChange={setCopies}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Copy (Original)</SelectItem>
                  <SelectItem value="2">2 Copies (Original + Duplicate)</SelectItem>
                  <SelectItem value="3">3 Copies (Original + Duplicate + Triplicate)</SelectItem>
                </SelectContent>
              </Select>
              {Number(copies) > 1 && (
                <p className="text-xs text-muted-foreground">Labels: {copyLabels.slice(0, Number(copies)).join(", ")}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
