import { useState, useEffect, useRef } from "react";
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

/** Always returns the pre-GST base rate per unit, regardless of inclusive/exclusive. */
function itemBaseRate(item: any): number {
  const qty = Number(item.quantity) || 0;
  const discPct = Number(item.discountPct) || 0;
  const factor = 1 - discPct / 100;
  if (qty === 0 || factor === 0) return 0;
  return Number(item.taxableAmount) / qty / factor;
}

const PRINT_SETTINGS_KEY = "print_settings";

function loadPrintSettings() {
  try { return JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY) || "{}"); }
  catch { return {}; }
}

const BASE_PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
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

function fmtN(n: number) {
  return "₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function buildInvoiceHtml(inv: any, company: any, ps: any): string {
  const showHsn = ps.showHsnCode !== false;
  const showBank = ps.showBankDetails !== false;
  const showSig = ps.showSignatureLine !== false;
  const showAddr = ps.showAddress !== false;
  const showGstin = ps.showGstin !== false;
  const showPartyGstin = ps.showPartyGstin !== false;
  const showLogo = ps.showLogo !== false;
  const showFooter = ps.showFooter !== false;
  const billTitle = ps.billTitle || "TAX INVOICE";
  const terms = ps.termsAndConditions || "";

  const co = company as any;
  const logoHtml = showLogo && co?.logoUrl
    ? `<img class="co-logo" src="${co.logoUrl}" alt="Logo">`
    : "";
  const coName = co?.companyName || co?.name || "";
  const coAddr = showAddr ? [co?.address, co?.city, co?.state, co?.pincode].filter(Boolean).join(", ") : "";
  const coGstin = showGstin && co?.gstin ? `GSTIN: ${co.gstin}` : "";

  const items: any[] = inv?.items || [];
  const otherCharges: { name: string; amount: number }[] = (() => {
    try { return JSON.parse(inv?.otherCharges || "[]"); } catch { return []; }
  })();

  const itemRows = items.map((item: any, i: number) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.itemName || ""}${item.description ? `<div style="font-size:.82em;color:#6b7280;font-style:italic;margin-top:1px">${item.description}</div>` : ""}</td>
      ${showHsn ? `<td>${item.hsnCode || ""}</td>` : ""}
      <td class="tr">${item.quantity} ${item.unit || ""}</td>
      <td class="tr">${fmtN(itemBaseRate(item))}</td>
      <td class="tr">${item.discountPct || 0}%</td>
      <td class="tr">${item.gstPct || 0}%</td>
      <td class="tr"><strong>${fmtN(item.total)}</strong></td>
    </tr>`).join("");

  const totalsHtml = [
    `<div class="tot-row"><span>Subtotal</span><span>${fmtN(inv?.subtotal)}</span></div>`,
    Number(inv?.totalDiscount) > 0
      ? `<div class="tot-row disc"><span>Discount</span><span>−${fmtN(inv?.totalDiscount)}</span></div>` : "",
    Number(inv?.totalCgst) > 0
      ? `<div class="tot-row"><span>CGST</span><span>${fmtN(inv?.totalCgst)}</span></div>` : "",
    Number(inv?.totalSgst) > 0
      ? `<div class="tot-row"><span>SGST</span><span>${fmtN(inv?.totalSgst)}</span></div>` : "",
    Number(inv?.totalIgst) > 0
      ? `<div class="tot-row"><span>IGST</span><span>${fmtN(inv?.totalIgst)}</span></div>` : "",
    ...otherCharges.map(c => `<div class="tot-row"><span>${c.name || "Other"}</span><span>${fmtN(c.amount)}</span></div>`),
    `<div class="tot-row grand"><span>Total</span><span>${fmtN(inv?.grandTotal)}</span></div>`,
    `<div class="tot-row paid"><span>Paid</span><span>${fmtN(inv?.amountPaid)}</span></div>`,
    Number(inv?.balanceDue) > 0
      ? `<div class="tot-row due"><span>Balance Due</span><span>${fmtN(inv?.balanceDue)}</span></div>` : "",
  ].join("");

  const bankHtml = showBank && co?.bankAccount ? `
    <div class="bank">
      <div class="sec-label">Bank Details</div>
      <div>${co.bankName ? co.bankName + " — " : ""}A/C: ${co.bankAccount}</div>
      ${co.bankIfsc ? `<div>IFSC: ${co.bankIfsc}${co.bankBranch ? " | Branch: " + co.bankBranch : ""}</div>` : ""}
    </div>` : "";

  const sigHtml = showSig ? `
    <div class="sigs">
      <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">Customer Signature</div></div>
      <div class="sig-blk"><div class="sig-line"></div><div class="sig-lbl">For ${coName}<br>Authorised Signatory</div></div>
    </div>` : "";

  const termsHtml = terms ? `<div class="terms"><div class="sec-label">Terms &amp; Conditions</div><div>${terms}</div></div>` : "";
  const footerHtml = showFooter && co?.billFooter ? `<div class="bill-ftr">${co.billFooter}</div>` : "";

  return `<div class="invoice">
  <div class="inv-header">
    <div class="co-info">${logoHtml}<div class="co-text"><div class="co-name">${coName}</div>${coAddr ? `<div class="co-addr">${coAddr}</div>` : ""}${coGstin ? `<div class="co-gstin">${coGstin}</div>` : ""}${co?.phone ? `<div class="co-phone">${co.phone}</div>` : ""}</div></div>
    <div class="inv-meta"><div class="inv-title">${billTitle}</div><div class="inv-num">#${inv?.invoiceNumber || ""}</div><div class="inv-date">Date: ${inv?.date ? new Date(inv.date).toLocaleDateString("en-IN") : ""}</div></div>
  </div>
  <div class="bill-to">
    <div class="bt-label">Bill To</div>
    <div class="bt-name">${inv?.partyName || inv?.customerName || "—"}</div>
    ${showPartyGstin && inv?.partyGstin ? `<div class="bt-gstin">GSTIN: ${inv.partyGstin}</div>` : ""}
    ${inv?.billingAddress ? `<div class="bt-addr">${inv.billingAddress}</div>` : ""}
  </div>
  <table class="items-tbl">
    <thead><tr>
      <th>#</th><th>Item</th>
      ${showHsn ? "<th>HSN</th>" : ""}
      <th class="tr">Qty</th><th class="tr">Rate</th><th class="tr">Disc%</th><th class="tr">GST%</th><th class="tr">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="inv-footer">${bankHtml}<div class="totals">${totalsHtml}</div></div>
  ${termsHtml}${sigHtml}${footerHtml}
</div>`;
}

const BASE_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  .tr{text-align:right}
  .co-info{display:flex;align-items:flex-start;gap:10px}
  .co-logo{height:52px;width:auto;object-fit:contain;flex-shrink:0}
  .inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
  .inv-meta{text-align:right}
  .inv-num{font-family:monospace;font-size:.9em;margin-top:3px}
  .inv-date{font-size:.88em;color:#555;margin-top:2px}
  .bill-to{padding:8px 0;margin-bottom:14px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb}
  .bt-label{font-size:.75em;text-transform:uppercase;color:#6b7280;margin-bottom:2px}
  .bt-name{font-weight:700;font-size:1.05em}
  .bt-gstin,.bt-addr{font-size:.85em;color:#555;margin-top:2px}
  .items-tbl{width:100%;border-collapse:collapse;margin-bottom:14px}
  .inv-footer{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}
  .bank{font-size:.83em;color:#444;max-width:240px}
  .sec-label{font-weight:600;font-size:.75em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;letter-spacing:.04em}
  .totals{min-width:210px}
  .tot-row{display:flex;justify-content:space-between;padding:2px 0;font-size:.9em}
  .tot-row.grand{font-weight:700;font-size:1.05em;border-top:1px solid #9ca3af;padding-top:4px;margin-top:3px}
  .tot-row.paid{color:#16a34a}
  .tot-row.due{color:#dc2626;font-weight:600}
  .tot-row.disc{color:#dc2626}
  .sigs{display:flex;justify-content:space-between;margin-top:36px}
  .sig-blk{text-align:center}
  .sig-line{border-bottom:1px solid #9ca3af;width:150px;height:44px;margin-bottom:5px}
  .sig-lbl{font-size:.78em;color:#6b7280}
  .terms{margin-top:12px;font-size:.8em;color:#6b7280;padding-top:8px;border-top:1px solid #e5e7eb}
  .bill-ftr{margin-top:14px;text-align:center;font-size:.83em;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:8px}
`;

const PRINT_CSS: Record<string, string> = {
  a4_1: `${BASE_CSS}
    body{font-family:Arial,sans-serif;font-size:13px;padding:16mm;max-width:210mm;color:#000}
    .co-name{font-size:1.2em;font-weight:700}
    .co-addr,.co-gstin,.co-phone{font-size:.85em;color:#444;margin-top:1px}
    .inv-title{font-size:1.6em;font-weight:700;color:#4f46e5}
    .items-tbl th{background:#f3f4f6;padding:6px 8px;text-align:left;border:1px solid #d1d5db;font-size:.82em}
    .items-tbl td{padding:5px 8px;border:1px solid #e5e7eb;font-size:.9em}
    @page{size:A4 portrait;margin:0}`,

  a4_2: `${BASE_CSS}
    body{font-family:Arial,sans-serif;font-size:13px;max-width:210mm;color:#000;padding:0}
    .inv-header{background:#4f46e5;color:#fff;padding:14mm 16mm 10mm;margin-bottom:0}
    .co-name{font-size:1.2em;font-weight:700;color:#fff}
    .co-addr,.co-gstin,.co-phone{font-size:.85em;color:rgba(255,255,255,.75);margin-top:1px}
    .inv-title{font-size:1.5em;font-weight:700;color:#fff}
    .inv-num,.inv-date{color:rgba(255,255,255,.8)}
    .bill-to{margin:0 16mm 10px;border-top:2px solid #4f46e5;border-bottom:none;padding:8px 0}
    .items-tbl{margin:0 16mm;width:calc(100% - 32mm)}
    .items-tbl th{padding:7px 8px;text-align:left;border-bottom:2px solid #4f46e5;color:#4f46e5;font-size:.82em;background:none}
    .items-tbl td{padding:6px 8px;border-bottom:1px solid #f3f4f6;font-size:.9em}
    .items-tbl tbody tr:nth-child(even) td{background:#f5f3ff}
    .tot-row.grand{color:#4f46e5}
    .inv-footer,.terms,.sigs,.bill-ftr{padding:0 16mm}
    .inv-footer{margin:14px 0}
    @page{size:A4 portrait;margin:0}`,

  a4_3: `${BASE_CSS}
    body{font-family:Georgia,'Times New Roman',serif;font-size:12px;padding:20mm;max-width:210mm;color:#111}
    .co-name{font-size:1.3em;font-weight:700;letter-spacing:.02em}
    .co-addr,.co-gstin,.co-phone{font-size:.85em;color:#555;margin-top:1px}
    .inv-title{font-size:1.4em;font-weight:400;letter-spacing:.12em;text-transform:uppercase}
    .bill-to{border-top:2px solid #111;border-bottom:1px solid #ccc;padding:8px 0}
    .items-tbl th{padding:6px 4px;text-align:left;border-bottom:2px solid #111;font-size:.8em;text-transform:uppercase;letter-spacing:.05em;background:none}
    .items-tbl td{padding:5px 4px;border-bottom:1px solid #e5e7eb;font-size:.9em}
    .tot-row.grand{border-top:2px solid #111}
    @page{size:A4 portrait;margin:0}`,

  a5_1: `${BASE_CSS}
    body{font-family:Arial,sans-serif;font-size:11px;padding:10mm;max-width:148mm;color:#000}
    .co-logo{height:40px}
    .co-name{font-size:1.15em;font-weight:700}
    .co-addr,.co-gstin,.co-phone{font-size:.85em;color:#555;margin-top:1px}
    .inv-title{font-size:1.3em;font-weight:700;color:#4f46e5}
    .items-tbl th{background:#f3f4f6;padding:4px 6px;text-align:left;border:1px solid #d1d5db;font-size:.8em}
    .items-tbl td{padding:3px 6px;border:1px solid #e5e7eb;font-size:.88em}
    .tot-row{font-size:.88em}
    .sigs{margin-top:24px}.sig-line{width:120px;height:34px}
    @page{size:A5 portrait;margin:0}`,

  a5_2: `${BASE_CSS}
    body{font-family:Arial,sans-serif;font-size:10px;padding:8mm;max-width:148mm;color:#000}
    .co-logo{height:34px}
    .co-name{font-size:1.15em;font-weight:700}
    .co-addr,.co-gstin,.co-phone{font-size:.85em;color:#555}
    .inv-title{font-size:1.2em;font-weight:700;color:#374151}
    .inv-header{margin-bottom:10px}
    .bill-to{padding:5px 0;margin-bottom:8px}
    .items-tbl th{background:#374151;color:#fff;padding:3px 5px;text-align:left;border:none;font-size:.8em}
    .items-tbl td{padding:3px 5px;border-bottom:1px solid #f3f4f6;font-size:.88em}
    .items-tbl tbody tr:nth-child(even) td{background:#f9fafb}
    .tot-row{padding:1.5px 0;font-size:.88em}
    .sigs{margin-top:18px}.sig-line{width:108px;height:28px}
    @page{size:A5 portrait;margin:0}`,

  a5_3: `${BASE_CSS}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5px;padding:0;max-width:148mm;color:#000}
    .inv-header{background:#1e293b;color:#fff;padding:9mm 9mm 7mm;margin-bottom:9mm}
    .co-logo{height:36px}
    .co-name{font-size:1.15em;font-weight:700;color:#fff}
    .co-addr,.co-gstin,.co-phone{font-size:.85em;color:rgba(255,255,255,.7);margin-top:1px}
    .inv-title{font-size:1.2em;font-weight:700;color:#fff}
    .inv-num,.inv-date{color:rgba(255,255,255,.75)}
    .bill-to{margin:0 9mm 8px;border-top:2px solid #1e293b;border-bottom:none;padding:6px 0}
    .items-tbl{margin:0 9mm;width:calc(100% - 18mm)}
    .items-tbl th{padding:4px 5px;text-align:left;border-bottom:2px solid #1e293b;color:#1e293b;font-size:.8em;background:none}
    .items-tbl td{padding:3px 5px;border-bottom:1px solid #f1f5f9;font-size:.88em}
    .tot-row{font-size:.88em}.tot-row.grand{color:#1e293b}
    .inv-footer,.terms,.sigs,.bill-ftr{padding:0 9mm}
    .inv-footer{margin:10px 0}
    .sigs{margin-top:20px}.sig-line{width:110px;height:30px}
    @page{size:A5 portrait;margin:0}`,

  thermal_1: `${BASE_CSS}
    body{font-family:'Courier New',Courier,monospace;font-size:11px;padding:3mm;width:80mm;max-width:80mm;color:#000}
    .inv-header{display:block;text-align:center;border-bottom:1px dashed #000;padding-bottom:7px;margin-bottom:7px}
    .co-info{display:block;text-align:center}
    .co-logo{height:42px;display:block;margin:0 auto 5px}
    .co-name{font-size:1.1em;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
    .co-addr,.co-gstin,.co-phone{font-size:.88em}
    .inv-meta{text-align:center;margin-top:5px}
    .inv-title{font-weight:700;text-transform:uppercase;font-size:1em}
    .bill-to{border-top:1px dashed #000;border-bottom:1px dashed #000;padding:5px 0;margin-bottom:6px}
    .bt-label{font-size:.78em}
    .items-tbl th{border-top:1px dashed #000;border-bottom:1px dashed #000;padding:2px 2px;font-size:.85em;background:none;text-align:left}
    .items-tbl td{padding:2px 2px;border:none;font-size:.9em}
    .inv-footer{display:block;border-top:1px dashed #000;padding-top:6px;margin-top:4px}
    .bank{margin-bottom:6px;border-bottom:1px dashed #000;padding-bottom:5px;font-size:.85em}
    .totals{width:100%}
    .tot-row{font-size:.9em}
    .tot-row.grand{font-size:1em;font-weight:700;border-top:1px solid #000;padding-top:3px}
    .sigs{display:block;text-align:center;margin-top:14px}
    .sig-blk{display:inline-block;margin:0 8px}
    .sig-line{width:90px;height:30px;margin:0 auto}
    .terms{font-size:.8em;border-top:1px dashed #000;padding-top:5px;margin-top:8px}
    .bill-ftr{border-top:1px dashed #000;padding-top:5px;margin-top:8px;font-size:.85em}
    @page{size:80mm auto;margin:0}`,

  thermal_2: `${BASE_CSS}
    body{font-family:'Courier New',Courier,monospace;font-size:11px;padding:3mm;width:80mm;max-width:80mm;color:#000}
    .inv-header{display:block;text-align:center;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:6px}
    .co-info{display:block;text-align:center}
    .co-logo{height:38px;display:block;margin:0 auto 4px}
    .co-name{font-size:1.1em;font-weight:700}
    .co-addr,.co-gstin,.co-phone{font-size:.88em}
    .inv-meta{text-align:center;margin-top:4px}
    .inv-title{font-weight:700;text-transform:uppercase}
    .bill-to{border-top:1px solid #000;border-bottom:1px solid #000;padding:4px 0;margin-bottom:5px}
    .items-tbl th{border-top:1px solid #000;border-bottom:1px solid #000;padding:2px;font-size:.85em;background:none;text-align:left}
    .items-tbl td{padding:2px;border:none;font-size:.9em}
    .inv-footer{display:block;border-top:1px solid #000;padding-top:5px;margin-top:3px}
    .bank{display:none}
    .totals{width:100%}
    .tot-row.grand{font-weight:700;border-top:1px solid #000;padding-top:3px}
    .sigs{display:block;text-align:center;margin-top:12px}
    .sig-blk{display:inline-block;margin:0 8px}
    .sig-line{width:84px;height:28px;margin:0 auto}
    .terms{font-size:.8em;border-top:1px solid #000;padding-top:4px}
    .bill-ftr{border-top:1px solid #000;padding-top:4px;margin-top:6px;font-size:.85em}
    @page{size:80mm auto;margin:0}`,

  thermal_3: `${BASE_CSS}
    body{font-family:'Courier New',Courier,monospace;font-size:11px;padding:2mm;width:80mm;max-width:80mm;color:#000}
    .inv-header{display:block;text-align:center;margin-bottom:5px}
    .co-info{display:block;text-align:center}
    .co-logo{display:none}
    .co-name{font-size:1.15em;font-weight:700;text-transform:uppercase;letter-spacing:1px}
    .co-addr,.co-gstin,.co-phone{display:none}
    .inv-meta{text-align:center;margin-top:3px}
    .inv-title{font-weight:700;text-transform:uppercase}
    .bill-to{padding:3px 0;margin-bottom:4px;border-top:1px dashed #000;border-bottom:none}
    .bt-gstin,.bt-addr{display:none}
    .items-tbl th{border-top:1px dashed #000;border-bottom:1px dashed #000;padding:2px;background:none;font-size:.85em;text-align:left}
    .items-tbl td{padding:1px 2px;border:none;font-size:.9em}
    .inv-footer{display:block;border-top:1px dashed #000;padding-top:3px}
    .bank{display:none}
    .totals{width:100%}
    .tot-row.grand{font-weight:700;border-top:1px solid #000;padding-top:3px}
    .sigs{display:block;text-align:center;margin-top:10px}
    .sig-blk{display:inline-block;margin:0 6px}
    .sig-line{width:78px;height:26px;margin:0 auto}
    .terms{display:none}
    .bill-ftr{text-align:center;border-top:1px dashed #000;padding-top:4px;margin-top:6px}
    @page{size:80mm auto;margin:0}`
};

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
                <td className="py-2">
                  <div>{item.itemName}</div>
                  {item.description && <div className="text-xs text-gray-500 italic mt-0.5">{item.description}</div>}
                </td>
                {showHsnCode && <td className="py-2 text-gray-500">{item.hsnCode}</td>}
                <td className="py-2 text-right">{item.quantity} {item.unit}</td>
                <td className="py-2 text-right">{formatCurrency(itemBaseRate(item))}</td>
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
          {invoice.payments.map((p: any, i: number) => {
            const modeLabel = allPaymentModes.find(m => m.value === p.mode)?.label
              ?? (p.mode === "receipt_voucher" ? "Receipt Voucher" : p.mode?.replace(/_/g, " ") ?? "");
            return (
              <p key={i} className="text-sm text-gray-500 capitalize">
                {modeLabel}: {formatCurrency(p.amount)}{p.reference ? ` (Ref: ${p.reference})` : ""}
              </p>
            );
          })}
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
              <td className="py-1.5 text-right">{formatCurrency(itemBaseRate(item))}</td>
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
  const [bankAccounts, setBankAccounts] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    customFetch<any>("/api/ledgers?group=Bank%20Accounts").then((data: any) => {
      if (Array.isArray(data)) setBankAccounts(data.map((l: any) => ({ value: `bank_${l.id}`, label: l.name })));
    }).catch(() => {});
  }, []);

  const allPaymentModes = [...BASE_PAYMENT_MODES, ...bankAccounts];

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
      const msg = err?.data?.error || "Failed to record payment";
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

  const buildPrintHtml = (numCopies: number) => {
    const printerType = ps.printerType || "a4";
    const layoutStyle = ps.layoutStyle || "1";
    const cssKey = `${printerType}_${layoutStyle}`;
    const css = PRINT_CSS[cssKey] || PRINT_CSS["a4_1"];
    const invoiceBody = buildInvoiceHtml(inv, company, ps);
    const elements: string[] = [];
    for (let i = 0; i < numCopies; i++) {
      const pageBreak = i > 0 ? `<div style="page-break-before:always"></div>` : "";
      const copyBadge = numCopies > 1
        ? `<div style="text-align:right;font-size:11px;font-weight:600;color:#999;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">${copyLabels[i] || `Copy ${i + 1}`}</div>`
        : "";
      elements.push(`${pageBreak}${copyBadge}${invoiceBody}`);
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${inv?.invoiceNumber}</title><style>${css}@media print{@page{margin:0}}</style></head><body>${elements.join("")}</body></html>`;
  };

  const handleOpenPreview = () => {
    const html = buildPrintHtml(Number(copies));
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setPreviewBlobUrl(url);
    setPrintDialogOpen(false);
    setPreviewOpen(true);
  };

  const handlePrintFromPreview = () => {
    iframeRef.current?.contentWindow?.print();
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!invoice) return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
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
            <Button onClick={handleOpenPreview}><Printer className="h-4 w-4 mr-2" />Preview & Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print preview dialog */}
      <Dialog open={previewOpen} onOpenChange={v => { if (!v) handleClosePreview(); }}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col gap-3 p-4">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-muted-foreground" />
              Print Preview — {inv?.invoiceNumber}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {ps.printerType?.toUpperCase() || "A4"} · Layout {ps.layoutStyle || "1"} · {copies} {Number(copies) === 1 ? "copy" : "copies"}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-lg border bg-gray-100 min-h-0">
            {previewBlobUrl && (
              <iframe
                ref={iframeRef}
                src={previewBlobUrl}
                className="w-full h-full"
                title="Print Preview"
              />
            )}
          </div>
          <div className="flex justify-between items-center pt-1">
            <Button variant="outline" onClick={handleClosePreview}>Cancel</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { handleClosePreview(); setPrintDialogOpen(true); }}>
                Change Settings
              </Button>
              <Button onClick={handlePrintFromPreview}>
                <Printer className="h-4 w-4 mr-2" />Print Now
              </Button>
            </div>
          </div>
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
                  {allPaymentModes.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
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
