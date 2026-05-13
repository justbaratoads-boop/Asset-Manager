import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetSaleInvoice, useGetCompanySettings, getGetSaleInvoiceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { Printer, ArrowLeft, Copy, IndianRupee, Edit, FileCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

const PRINT_SETTINGS_KEY = "print_settings";

function loadPrintSettings() {
  try { return JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY) || "{}"); }
  catch { return {}; }
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    paid: "bg-green-100 text-green-700 border-green-200",
    partial: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  return map[status] || "bg-gray-100 text-gray-600";
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
    <div className="bg-white border rounded-xl p-4 sm:p-8 max-w-3xl mx-auto text-black" id="invoice-print">
      {copyLabel && (
        <div className="text-right text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">{copyLabel}</div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
        <div className="flex items-start gap-3">
          {showLogo && company?.logoUrl && (
            <img src={company.logoUrl} alt="Logo" className="h-14 w-auto object-contain shrink-0" />
          )}
          <div>
            <h2 className="text-lg sm:text-xl font-bold">{company?.companyName || company?.name || "Company Name"}</h2>
            {showAddress && (
              <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-line">
                {company?.address}{company?.city ? `, ${company.city}` : ""}{company?.state ? `, ${company.state}` : ""}{company?.pincode ? ` - ${company.pincode}` : ""}
              </p>
            )}
            {showGstin && company?.gstin && <p className="text-xs sm:text-sm">GSTIN: {company.gstin}</p>}
            {company?.phone && <p className="text-xs sm:text-sm">{company.phone}</p>}
            {company?.email && <p className="text-xs sm:text-sm">{company.email}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <h1 className="text-xl sm:text-2xl font-bold text-primary">{billTitle}</h1>
          <p className="font-mono text-sm">#{invoice.invoiceNumber}</p>
          <p className="text-sm">{formatDate(invoice.date)}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="border-t border-b py-3 mb-5">
        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Bill To</p>
        <p className="font-semibold">{invoice.partyName}</p>
        {showPartyGstin && invoice.partyGstin && <p className="text-sm">GSTIN: {invoice.partyGstin}</p>}
        {invoice.billingAddress && <p className="text-sm text-gray-600">{invoice.billingAddress}</p>}
      </div>

      {/* Items */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm mb-6 min-w-[500px] px-4 sm:px-0">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pl-4 sm:pl-0 font-semibold w-6">#</th>
              <th className="text-left py-2 font-semibold">Item</th>
              {showHsnCode && <th className="text-left py-2 font-semibold">HSN</th>}
              <th className="text-right py-2 font-semibold">Qty</th>
              <th className="text-right py-2 font-semibold">Rate</th>
              <th className="text-right py-2 font-semibold">Disc%</th>
              <th className="text-right py-2 font-semibold">GST%</th>
              <th className="text-right py-2 pr-4 sm:pr-0 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item: any, i: number) => (
              <tr key={i} className="border-b">
                <td className="py-2 pl-4 sm:pl-0">{i + 1}</td>
                <td className="py-2">{item.itemName}</td>
                {showHsnCode && <td className="py-2 text-gray-500">{item.hsnCode}</td>}
                <td className="py-2 text-right">{item.quantity} {item.unit}</td>
                <td className="py-2 text-right">{formatCurrency(item.rate)}</td>
                <td className="py-2 text-right">{item.discountPct}%</td>
                <td className="py-2 text-right">{item.gstPct}%</td>
                <td className="py-2 text-right pr-4 sm:pr-0 font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-4">
        <div className="w-full sm:w-64 space-y-1 text-sm border rounded-lg p-3 sm:border-none sm:rounded-none sm:p-0">
          <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          {Number(invoice.totalDiscount) > 0 && (
            <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(invoice.totalDiscount)}</span></div>
          )}
          {Number(invoice.totalCgst) > 0 && (
            <div className="flex justify-between"><span className="text-gray-600">CGST</span><span>{formatCurrency(invoice.totalCgst)}</span></div>
          )}
          {Number(invoice.totalSgst) > 0 && (
            <div className="flex justify-between"><span className="text-gray-600">SGST</span><span>{formatCurrency(invoice.totalSgst)}</span></div>
          )}
          {Number(invoice.totalIgst) > 0 && (
            <div className="flex justify-between"><span className="text-gray-600">IGST</span><span>{formatCurrency(invoice.totalIgst)}</span></div>
          )}
          {(() => {
            let parsedCharges: {name: string; amount: number}[] = [];
            try { parsedCharges = JSON.parse(invoice.otherCharges || "[]"); } catch {}
            return parsedCharges.map((c: any, i: number) => (
              <div key={i} className="flex justify-between"><span className="text-gray-600">{c.name || "Other Charges"}</span><span>{formatCurrency(Number(c.amount))}</span></div>
            ));
          })()}
          <div className="flex justify-between font-bold text-base border-t pt-2 mt-1">
            <span>Total</span><span>{formatCurrency(invoice.grandTotal)}</span>
          </div>
          <div className="flex justify-between text-green-600">
            <span>Paid</span><span>{formatCurrency(invoice.amountPaid)}</span>
          </div>
          {Number(invoice.balanceDue) > 0 && (
            <div className="flex justify-between font-semibold text-red-600">
              <span>Balance Due</span><span>{formatCurrency(invoice.balanceDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment details */}
      {invoice.payments?.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-semibold mb-2">Payment Details</p>
          {invoice.payments.map((p: any, i: number) => (
            <p key={i} className="text-sm text-gray-500 capitalize">
              {p.mode?.replace("_", " ")}: {formatCurrency(p.amount)}{p.reference ? ` (Ref: ${p.reference})` : ""}
            </p>
          ))}
        </div>
      )}

      {/* Bank details */}
      {showBankDetails && company?.bankAccount && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-semibold mb-1">Bank Details</p>
          <p className="text-sm text-gray-600">{company.bankName} — A/C: {company.bankAccount}</p>
          {company.bankIfsc && (
            <p className="text-sm text-gray-600">IFSC: {company.bankIfsc}{company.bankBranch ? ` | Branch: ${company.bankBranch}` : ""}</p>
          )}
        </div>
      )}

      {/* Terms */}
      {termsAndConditions && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs font-semibold text-gray-500 mb-1">Terms & Conditions</p>
          <p className="text-xs text-gray-500 whitespace-pre-line">{termsAndConditions}</p>
        </div>
      )}

      {/* Signature */}
      {showSignatureLine && (
        <div className="mt-8 flex justify-between text-sm text-gray-500">
          <div className="text-center">
            <div className="border-t border-gray-400 mt-8 pt-1 w-32 sm:w-36">Customer Signature</div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 mt-8 pt-1 w-36 sm:w-48">
              For {company?.companyName || company?.name || ""}<br />Authorised Signatory
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {showFooter && company?.billFooter && (
        <div className="mt-8 pt-4 border-t text-center text-sm text-gray-500">{company.billFooter}</div>
      )}
    </div>
  );
}

function AcknowledgmentDocument({ invoice, company }: { invoice: any; company: any }) {
  const ps = loadPrintSettings();
  const showLogo = ps.showLogo !== false;
  const amountPaid = Number(invoice.amountPaid) || 0;
  const grandTotal = Number(invoice.grandTotal) || 0;
  const isFullyPaid = amountPaid >= grandTotal;

  return (
    <div id="acknowledgment-print" className="bg-white border rounded-xl p-8 max-w-2xl mx-auto text-black text-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-start gap-3">
          {showLogo && company?.logoUrl && (
            <img src={company.logoUrl} alt="Logo" className="h-12 w-auto object-contain shrink-0" />
          )}
          <div>
            <p className="font-bold text-base">{company?.companyName || company?.name || ""}</p>
            {company?.address && <p className="text-xs text-gray-500">{company.address}{company?.city ? `, ${company.city}` : ""}{company?.state ? `, ${company.state}` : ""}</p>}
            {company?.gstin && <p className="text-xs text-gray-500">GSTIN: {company.gstin}</p>}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold uppercase tracking-wide text-gray-800">Acknowledgment</h1>
          <p className="text-xs text-gray-500 mt-0.5">Against Invoice #{invoice.invoiceNumber}</p>
          <p className="text-xs text-gray-500">{formatDate(invoice.date)}</p>
        </div>
      </div>

      {/* Party */}
      <div className="border rounded-lg px-4 py-3 mb-5 bg-gray-50">
        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Received From</p>
        <p className="font-semibold text-base">{invoice.partyName || invoice.customerName || "—"}</p>
      </div>

      {/* Items */}
      <table className="w-full mb-5 text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-2 font-semibold w-6">#</th>
            <th className="text-left py-2 font-semibold">Item Description</th>
            <th className="text-right py-2 font-semibold">Qty</th>
            <th className="text-right py-2 font-semibold">Rate</th>
            <th className="text-right py-2 font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items?.map((item: any, i: number) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-1.5">{i + 1}</td>
              <td className="py-1.5">{item.itemName}</td>
              <td className="py-1.5 text-right">{item.quantity} {item.unit}</td>
              <td className="py-1.5 text-right">{formatCurrency(item.rate)}</td>
              <td className="py-1.5 text-right font-medium">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-56 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          {Number(invoice.totalDiscount) > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-{formatCurrency(invoice.totalDiscount)}</span></div>}
          {Number(invoice.totalCgst) > 0 && <div className="flex justify-between text-gray-500"><span>CGST</span><span>{formatCurrency(invoice.totalCgst)}</span></div>}
          {Number(invoice.totalSgst) > 0 && <div className="flex justify-between text-gray-500"><span>SGST</span><span>{formatCurrency(invoice.totalSgst)}</span></div>}
          {Number(invoice.totalIgst) > 0 && <div className="flex justify-between text-gray-500"><span>IGST</span><span>{formatCurrency(invoice.totalIgst)}</span></div>}
          <div className="flex justify-between font-bold text-base border-t pt-2 mt-1"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
          <div className="flex justify-between text-green-600 font-medium"><span>Amount Received</span><span>{formatCurrency(amountPaid)}</span></div>
          {!isFullyPaid && (
            <div className="flex justify-between text-red-500 font-medium"><span>Balance Due</span><span>{formatCurrency(grandTotal - amountPaid)}</span></div>
          )}
        </div>
      </div>

      {/* Receipt Statement */}
      <div className="border-2 border-gray-300 rounded-lg p-4 mb-8 bg-gray-50">
        <p className="text-sm leading-relaxed text-gray-700">
          I / We hereby acknowledge the receipt of goods and{" "}
          {isFullyPaid
            ? <>an amount of <span className="font-bold text-black">{formatCurrency(amountPaid)}</span> (in full settlement) against Invoice <span className="font-semibold">#{invoice.invoiceNumber}</span> dated {formatDate(invoice.date)}.</>
            : <>a partial payment of <span className="font-bold text-black">{formatCurrency(amountPaid)}</span> against Invoice <span className="font-semibold">#{invoice.invoiceNumber}</span> dated {formatDate(invoice.date)}. Balance due: <span className="font-bold text-red-600">{formatCurrency(grandTotal - amountPaid)}</span>.</>
          }
          {" "}All goods have been received in good condition.
        </p>
      </div>

      {/* Signatures */}
      <div className="flex justify-between items-end mt-4">
        <div className="text-center space-y-2">
          <div className="h-12 border-b border-gray-400 w-40"></div>
          <p className="text-xs text-gray-500">Date: _______________</p>
        </div>
        <div className="text-center space-y-2">
          <div className="h-12 border-b border-gray-400 w-48"></div>
          <p className="text-xs text-gray-500">Customer Signature &amp; Stamp</p>
        </div>
        <div className="text-center space-y-2">
          <div className="h-12 border-b border-gray-400 w-48"></div>
          <p className="text-xs text-gray-500">
            For {company?.companyName || company?.name || ""}<br />
            <span className="text-gray-400">Authorised Signatory</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SaleInvoiceView() {
  const [, params] = useRoute("/sales/invoices/:id");
  const [, search] = useLocation();
  const id = Number(params?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: invoice, isLoading } = useGetSaleInvoice(id, { query: { enabled: !!id } });
  const { data: company } = useGetCompanySettings();

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [copies, setCopies] = useState("1");
  const ps = loadPrintSettings();
  const defaultCopies = ps.invoiceCopies || "1";
  const copyLabelsStr = ps.copyLabels || "Original, Duplicate, Triplicate";
  const copyLabels = copyLabelsStr.split(",").map((s: string) => s.trim());
  const acknowledgmentEnabled = ps.printAcknowledgment === true;

  // Record payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payError, setPayError] = useState("");
  const [isSavingPay, setIsSavingPay] = useState(false);

  const inv = invoice as any;
  const balanceDue = Number(inv?.balanceDue) || 0;

  const openPayDialog = () => {
    setPayAmount(String(balanceDue.toFixed(2)));
    setPayMode("cash");
    setPayRef("");
    setPayError("");
    setPayDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { setPayError("Enter a valid amount"); return; }
    if (amt > balanceDue) { setPayError(`Amount cannot exceed balance due (${formatCurrency(balanceDue)})`); return; }
    setIsSavingPay(true);
    try {
      await customFetch(`/api/sale-invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: payMode, amount: amt, reference: payRef }),
      });
      await queryClient.invalidateQueries({ queryKey: getGetSaleInvoiceQueryKey(id) });
      toast({ title: "Payment recorded successfully" });
      setPayDialogOpen(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Failed to record payment";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSavingPay(false);
    }
  };

  useEffect(() => {
    if (new URLSearchParams(search || "").get("print") === "1") {
      setPrintDialogOpen(true);
    }
  }, [search]);

  const handlePrintAcknowledgment = () => {
    const content = document.getElementById("acknowledgment-print")?.innerHTML || "";
    const html = `<!DOCTYPE html><html><head><title>Acknowledgment - ${inv?.invoiceNumber}</title><style>body{font-family:sans-serif;font-size:13px;padding:24px;color:#000;max-width:700px;margin:0 auto}table{border-collapse:collapse;width:100%}@media print{body{padding:0}}</style></head><body>${content}</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

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
    const html = `<!DOCTYPE html><html><head><title>Invoice ${inv?.invoiceNumber}</title><style>body{font-family:sans-serif;font-size:13px;padding:16px;color:#000}table{border-collapse:collapse;width:100%}@media print{.no-print{display:none}}</style></head><body>${elements.join("")}</body></html>`;
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
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Link href="/sales/invoices">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          </Link>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusBadge(inv.status)}`}>
            {inv.status}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {balanceDue > 0 && (
            <Button size="sm" variant="default" onClick={openPayDialog} className="gap-1.5 bg-green-600 hover:bg-green-700">
              <IndianRupee className="h-4 w-4" />
              <span className="hidden sm:inline">Record Payment</span>
              <span className="sm:hidden">Pay</span>
            </Button>
          )}
          <Link href={`/sales/invoices/${id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Edit className="h-4 w-4" /><span className="hidden sm:inline">Edit</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => { setCopies("2"); setPrintDialogOpen(true); }}>
            <Copy className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Print 2nd Copy</span>
          </Button>
          {acknowledgmentEnabled && (
            <Button variant="outline" size="sm" onClick={handlePrintAcknowledgment} className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
              <FileCheck className="h-4 w-4" /><span className="hidden sm:inline">Print Acknowledgment</span>
            </Button>
          )}
          <Button size="sm" onClick={() => { setCopies(defaultCopies); setPrintDialogOpen(true); }}>
            <Printer className="h-4 w-4 mr-1" />Print
          </Button>
        </div>
      </div>

      {/* Balance due banner */}
      {balanceDue > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 print:hidden">
          <div>
            <p className="text-sm font-semibold text-amber-800">Payment Pending</p>
            <p className="text-xs text-amber-600">
              {formatCurrency(Number(inv.amountPaid))} received of {formatCurrency(inv.grandTotal)} —{" "}
              <span className="font-bold">{formatCurrency(balanceDue)} still due</span>
            </p>
          </div>
          <Button size="sm" onClick={openPayDialog} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shrink-0">
            <IndianRupee className="h-3.5 w-3.5" />Collect Now
          </Button>
        </div>
      )}

      <InvoiceDocument invoice={inv} company={company as any} />

      {/* Hidden acknowledgment document — rendered offscreen for print */}
      {acknowledgmentEnabled && (
        <div className="hidden print:hidden" aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <AcknowledgmentDocument invoice={inv} company={company as any} />
        </div>
      )}

      {/* Print dialog */}
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

      {/* Record Payment dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Total</span>
                <span className="font-medium">{formatCurrency(inv.grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Paid</span>
                <span className="font-medium text-green-600">{formatCurrency(inv.amountPaid)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="font-semibold">Balance Due</span>
                <span className="font-bold text-red-600">{formatCurrency(balanceDue)}</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Amount Received *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input
                  className="pl-7 h-10 text-base font-semibold"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="any"
                  value={payAmount}
                  onChange={e => { setPayAmount(e.target.value); setPayError(""); }}
                  autoFocus
                />
              </div>
              {payError && <p className="text-xs text-destructive">{payError}</p>}
            </div>

            <div className="space-y-1">
              <Label>Payment Mode</Label>
              <Select value={payMode} onValueChange={setPayMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Reference / Cheque No. <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. UTR number, cheque no."
                value={payRef}
                onChange={e => setPayRef(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={isSavingPay} className="bg-green-600 hover:bg-green-700">
              <IndianRupee className="h-4 w-4 mr-1" />
              {isSavingPay ? "Saving..." : "Record Payment"}
            </Button>
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
