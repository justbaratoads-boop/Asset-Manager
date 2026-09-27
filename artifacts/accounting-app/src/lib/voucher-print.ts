import { formatDate, formatCurrency } from "@/lib/format";

export function numberToWords(amount: number | string | undefined): string {
  const num = Math.floor(Math.abs(Number(amount || 0)));
  if (num === 0) return "Zero Rupees Only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ",
    "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return "";
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const units = a[n % 10];
    return (tens ? tens + " " : "") + units;
  }

  const crores = Math.floor(num / 10000000);
  const lakhs = Math.floor((num % 10000000) / 100000);
  const thousands = Math.floor((num % 100000) / 1000);
  const hundreds = Math.floor((num % 1000) / 100);
  const remainder = num % 100;

  let str = "";
  if (crores > 0) str += convertLessThanThousand(crores) + "Crore ";
  if (lakhs > 0) str += convertLessThanThousand(lakhs) + "Lakh ";
  if (thousands > 0) str += convertLessThanThousand(thousands) + "Thousand ";
  if (hundreds > 0) str += a[hundreds] + "Hundred ";
  if (remainder > 0) str += (str ? "and " : "") + convertLessThanThousand(remainder);

  return str.trim() + " Rupees Only";
}

export type VoucherType = "journal" | "contra" | "receipt" | "payment";

export interface VoucherPrintOptions {
  type: VoucherType;
  voucher: any;
  company?: any;
  ledgers?: any[];
}

export function buildVoucherHtml({ type, voucher, company, ledgers = [] }: VoucherPrintOptions): string {
  const coName = company?.name || company?.companyName || "COMPANY NAME";
  const coAddress = company?.address || "";
  const coPhone = company?.phone ? `Phone: ${company.phone}` : "";
  const coGstin = company?.gstin ? `GSTIN: ${company.gstin}` : "";
  const coEmail = company?.email ? `Email: ${company.email}` : "";
  const coHeaderSub = [coAddress, coPhone, coGstin, coEmail].filter(Boolean).join(" | ");

  const typeTitles: Record<VoucherType, string> = {
    journal: "JOURNAL VOUCHER",
    contra: "CONTRA VOUCHER",
    receipt: "RECEIPT VOUCHER",
    payment: "PAYMENT VOUCHER",
  };

  const voucherTitle = typeTitles[type] || "VOUCHER";
  const voucherNo = voucher?.voucherNumber || "-";
  const dateStr = formatDate(voucher?.date);
  const narration = voucher?.narration || "";

  const findLedgerName = (id: number | string | undefined) => {
    if (!id) return "-";
    const found = ledgers.find((l: any) => String(l.id) === String(id));
    return found?.name || `Ledger #${id}`;
  };

  let rowsHtml = "";
  let metaHtml = "";
  let totalAmount = 0;

  if (type === "journal") {
    const lines: any[] = voucher?.lines || [];
    const drLines = lines.filter(l => l.type === "dr");
    const crLines = lines.filter(l => l.type === "cr");
    const totalDr = drLines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const totalCr = crLines.reduce((s, l) => s + Number(l.amount || 0), 0);
    totalAmount = totalDr;

    metaHtml = `
      <tr>
        <td class="meta-label">Voucher No:</td>
        <td class="meta-value font-mono"><strong>${voucherNo}</strong></td>
        <td class="meta-label text-right">Date:</td>
        <td class="meta-value text-right font-mono">${dateStr}</td>
      </tr>
    `;

    rowsHtml = `
      <thead>
        <tr>
          <th style="width: 40px;" class="text-center">#</th>
          <th>Particulars / Account Name</th>
          <th style="width: 140px;" class="text-right">Debit (₹)</th>
          <th style="width: 140px;" class="text-right">Credit (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${drLines.map((l, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td><strong>[Dr]</strong> ${l.ledgerName || l.partyName || findLedgerName(l.ledgerId)}</td>
            <td class="text-right font-mono font-semibold">${Number(l.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            <td class="text-right text-muted">-</td>
          </tr>
        `).join("")}
        ${crLines.map((l, i) => `
          <tr>
            <td class="text-center">${drLines.length + i + 1}</td>
            <td style="padding-left: 28px;"><strong>[Cr]</strong> To ${l.ledgerName || l.partyName || findLedgerName(l.ledgerId)}</td>
            <td class="text-right text-muted">-</td>
            <td class="text-right font-mono font-semibold">${Number(l.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        `).join("")}
        <tr class="total-row">
          <td colspan="2" class="text-right">TOTAL:</td>
          <td class="text-right font-mono">${totalDr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td class="text-right font-mono">${totalCr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    `;
  } else if (type === "contra") {
    const lines: any[] = voucher?.lines || [];
    const drLine = lines.find(l => l.type === "dr");
    const crLine = lines.find(l => l.type === "cr");
    totalAmount = Number(drLine?.amount || voucher?.totalDebit || 0);

    const sourceName = crLine?.ledgerName || findLedgerName(crLine?.ledgerId);
    const destName = drLine?.ledgerName || findLedgerName(drLine?.ledgerId);

    metaHtml = `
      <tr>
        <td class="meta-label">Voucher No:</td>
        <td class="meta-value font-mono"><strong>${voucherNo}</strong></td>
        <td class="meta-label text-right">Date:</td>
        <td class="meta-value text-right font-mono">${dateStr}</td>
      </tr>
      <tr>
        <td class="meta-label">Transfer Type:</td>
        <td class="meta-value" colspan="3">Cash ↔ Bank Internal Transfer</td>
      </tr>
    `;

    rowsHtml = `
      <thead>
        <tr>
          <th style="width: 40px;" class="text-center">#</th>
          <th>Account Details</th>
          <th style="width: 140px;">Type</th>
          <th style="width: 150px;" class="text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-center">1</td>
          <td><strong>From (Source):</strong> ${sourceName}</td>
          <td>Credited (Cr)</td>
          <td class="text-right font-mono font-semibold">${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td class="text-center">2</td>
          <td><strong>To (Destination):</strong> ${destName}</td>
          <td>Debited (Dr)</td>
          <td class="text-right font-mono font-semibold">${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr class="total-row">
          <td colspan="3" class="text-right">TOTAL TRANSFERRED:</td>
          <td class="text-right font-mono">${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    `;
  } else {
    // Receipt or Payment
    totalAmount = Number(voucher?.amount || 0);
    const partyName = voucher?.partyName || "Direct / Cash";
    const paymentMode = (voucher?.paymentMode || "cash").toUpperCase();
    const reference = voucher?.reference || "-";

    let allocs: any[] = [];
    if (voucher?.ledgerAllocations) {
      try {
        allocs = typeof voucher.ledgerAllocations === "string" ? JSON.parse(voucher.ledgerAllocations) : voucher.ledgerAllocations;
      } catch {}
    }

    metaHtml = `
      <tr>
        <td class="meta-label">Voucher No:</td>
        <td class="meta-value font-mono"><strong>${voucherNo}</strong></td>
        <td class="meta-label text-right">Date:</td>
        <td class="meta-value text-right font-mono">${dateStr}</td>
      </tr>
      <tr>
        <td class="meta-label">${type === "receipt" ? "Received From:" : "Paid To:"}</td>
        <td class="meta-value"><strong>${partyName}</strong></td>
        <td class="meta-label text-right">Payment Mode:</td>
        <td class="meta-value text-right"><strong>${paymentMode}</strong> ${reference !== "-" ? `(${reference})` : ""}</td>
      </tr>
    `;

    if (allocs && allocs.length > 0) {
      rowsHtml = `
        <thead>
          <tr>
            <th style="width: 40px;" class="text-center">#</th>
            <th>Account / Ledger</th>
            <th>Particulars</th>
            <th style="width: 160px;" class="text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${allocs.map((a, i) => `
            <tr>
              <td class="text-center">${i + 1}</td>
              <td><strong>${findLedgerName(a.ledgerId)}</strong></td>
              <td>${type === "receipt" ? "Amount Received" : "Amount Paid"}</td>
              <td class="text-right font-mono font-semibold">${Number(a.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join("")}
          <tr class="total-row">
            <td colspan="3" class="text-right">TOTAL AMOUNT:</td>
            <td class="text-right font-mono">${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      `;
    } else {
      const mainLedgerName = findLedgerName(voucher?.ledgerId);
      rowsHtml = `
        <thead>
          <tr>
            <th style="width: 40px;" class="text-center">#</th>
            <th>Account / Ledger</th>
            <th>Particulars</th>
            <th style="width: 160px;" class="text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="text-center">1</td>
            <td><strong>${mainLedgerName}</strong></td>
            <td>${type === "receipt" ? `Received from ${partyName}` : `Paid to ${partyName}`}</td>
            <td class="text-right font-mono font-semibold">${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3" class="text-right">TOTAL AMOUNT:</td>
            <td class="text-right font-mono">${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      `;
    }
  }

  const words = numberToWords(totalAmount);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${voucherTitle} - ${voucherNo}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      color: #111;
      margin: 0;
      padding: 16px;
      background: #fff;
    }
    .voucher-box {
      border: 1.5px solid #222;
      padding: 24px;
      max-width: 760px;
      margin: 0 auto;
      background: #fff;
    }
    .company-header {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
    }
    .company-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #000;
      margin-bottom: 4px;
    }
    .company-sub {
      font-size: 12px;
      color: #444;
      line-height: 1.5;
    }
    .title-banner {
      text-align: center;
      margin: 12px 0 16px 0;
      border-top: 1.5px solid #222;
      border-bottom: 1.5px solid #222;
      padding: 6px 0;
      background: #f7f7f7;
    }
    .title-text {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 12.5px;
    }
    .meta-table td {
      padding: 4px 6px;
      vertical-align: top;
    }
    .meta-label {
      font-weight: 600;
      color: #333;
      width: 110px;
    }
    .meta-value {
      color: #000;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 12.5px;
    }
    .data-table th, .data-table td {
      border: 1px solid #777;
      padding: 7px 8px;
    }
    .data-table th {
      background-color: #f1f3f5;
      font-weight: 700;
      color: #222;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-muted { color: #888; }
    .total-row td {
      font-weight: 800;
      background-color: #f8f9fa;
      border-top: 2px solid #222;
      font-size: 13px;
    }
    .amount-words-box {
      border: 1px dashed #666;
      padding: 8px 12px;
      background: #fafafa;
      margin-bottom: 14px;
      font-size: 12px;
    }
    .narration-box {
      border: 1px solid #ccc;
      padding: 8px 12px;
      background: #fff;
      margin-bottom: 30px;
      font-size: 12px;
    }
    .signatures-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 36px;
    }
    .signatures-table td {
      width: 33.33%;
      text-align: center;
      vertical-align: bottom;
      padding-top: 40px;
      font-size: 11.5px;
    }
    .sig-line {
      border-top: 1px solid #333;
      margin: 0 16px 4px 16px;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .voucher-box { border: 1.5px solid #000; padding: 18px; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="voucher-box">
    <!-- Company Header -->
    <div class="company-header">
      <div class="company-name">${coName}</div>
      ${coHeaderSub ? `<div class="company-sub">${coHeaderSub}</div>` : ""}
    </div>

    <!-- Title Banner -->
    <div class="title-banner">
      <span class="title-text">${voucherTitle}</span>
    </div>

    <!-- Metadata -->
    <table class="meta-table">
      ${metaHtml}
    </table>

    <!-- Items / Ledger Lines -->
    <table class="data-table">
      ${rowsHtml}
    </table>

    <!-- Amount in words -->
    <div class="amount-words-box">
      <strong>Amount in words:</strong> <em>${words}</em>
    </div>

    <!-- Narration -->
    ${narration ? `
      <div class="narration-box">
        <strong>Narration / Remarks:</strong>
        <p style="margin: 4px 0 0 0; color: #333;">${narration}</p>
      </div>
    ` : ""}

    <!-- Signatures -->
    <table class="signatures-table">
      <tr>
        <td>
          <div class="sig-line"></div>
          <div>${type === "receipt" || type === "payment" ? "Receiver / Depositor" : "Prepared By"}</div>
        </td>
        <td>
          <div class="sig-line"></div>
          <div>Checked / Verified By</div>
        </td>
        <td>
          <div class="sig-line"></div>
          <div><strong>For ${coName}</strong><br><span style="font-size: 10px; color: #555;">(Authorised Signatory)</span></div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

export function printVoucher(options: VoucherPrintOptions) {
  const html = buildVoucherHtml(options);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch {}
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {}
    }, 1500);
  }, 350);
}

export function formatVoucherShareText({ type, voucher, company, ledgers = [] }: VoucherPrintOptions): { title: string; text: string } {
  const coName = company?.name || company?.companyName || "Business";
  const voucherNo = voucher?.voucherNumber || "-";
  const dateStr = formatDate(voucher?.date);
  const narration = voucher?.narration || "";

  const findLedgerName = (id: number | string | undefined) => {
    if (!id) return "-";
    const found = ledgers.find((l: any) => String(l.id) === String(id));
    return found?.name || `Ledger #${id}`;
  };

  const typeLabels: Record<VoucherType, string> = {
    journal: "Journal Entry",
    contra: "Contra Voucher",
    receipt: "Receipt Voucher",
    payment: "Payment Voucher",
  };

  const title = `${typeLabels[type]} #${voucherNo}`;
  let detailsText = "";

  if (type === "journal") {
    const lines: any[] = voucher?.lines || [];
    const dr = lines.filter(l => l.type === "dr").map(l => `${l.ledgerName || findLedgerName(l.ledgerId)}: ${formatCurrency(l.amount)}`).join(", ");
    const cr = lines.filter(l => l.type === "cr").map(l => `${l.ledgerName || findLedgerName(l.ledgerId)}: ${formatCurrency(l.amount)}`).join(", ");
    detailsText = `*Amount:* ${formatCurrency(voucher?.totalDebit || 0)}\n*Dr Accounts:* ${dr || "-"}\n*Cr Accounts:* ${cr || "-"}`;
  } else if (type === "contra") {
    const lines: any[] = voucher?.lines || [];
    const drLine = lines.find(l => l.type === "dr");
    const crLine = lines.find(l => l.type === "cr");
    detailsText = `*Amount:* ${formatCurrency(voucher?.totalDebit || drLine?.amount || 0)}\n*From (Cr):* ${crLine?.ledgerName || findLedgerName(crLine?.ledgerId)}\n*To (Dr):* ${drLine?.ledgerName || findLedgerName(drLine?.ledgerId)}`;
  } else {
    // Receipt / Payment
    detailsText = `*Party:* ${voucher?.partyName || "Direct / Cash"}\n*Amount:* ${formatCurrency(voucher?.amount)}\n*Payment Mode:* ${(voucher?.paymentMode || "Cash").toUpperCase()}${voucher?.reference ? `\n*Ref No:* ${voucher.reference}` : ""}`;
  }

  const text = `🧾 *${typeLabels[type].toUpperCase()}*\n*Company:* ${coName}\n*Voucher No:* ${voucherNo}\n*Date:* ${dateStr}\n${detailsText}${narration ? `\n*Narration:* ${narration}` : ""}`;

  return { title, text };
}
