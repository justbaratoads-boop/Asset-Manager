import { formatDate, formatCurrency } from "@/lib/format";

export function formatSaleInvoiceShareText(inv: any, company?: any): string {
  if (!inv) return "";
  const coName = company?.name || company?.companyName || "Business";
  const invNo = inv.invoiceNumber || "-";
  const dateStr = formatDate(inv.date);
  const party = inv.partyName || "Cash Customer";
  const items: any[] = inv.items || [];

  const itemsList = items
    .slice(0, 10)
    .map((it: any) => `• ${it.itemName || "Item"} (${it.quantity} ${it.unit || ""}) - ${formatCurrency(Number(it.total || 0))}`)
    .join("\n");
  const moreItems = items.length > 10 ? `\n• ...and ${items.length - 10} more item(s)` : "";

  const grandTotal = formatCurrency(Number(inv.grandTotal || 0));
  const amountPaid = formatCurrency(Number(inv.amountPaid || 0));
  const balanceDue = formatCurrency(Number(inv.balanceDue || 0));

  const url = typeof window !== "undefined" ? `${window.location.origin}/sales/invoices/${inv.id}` : "";

  return `🧾 *SALE INVOICE #${invNo}*
*Company:* ${coName}
*Date:* ${dateStr}
*Customer:* ${party}
*Status:* ${(inv.status || "confirmed").toUpperCase()}

*Items:*
${itemsList || "• No items"}${moreItems}

*Grand Total:* ${grandTotal}
*Amount Paid:* ${amountPaid}
*Balance Due:* ${balanceDue}
${inv.notes ? `*Notes:* ${inv.notes}\n` : ""}${url ? `\n🔗 View Bill: ${url}` : ""}`.trim();
}

export function formatPurchaseInvoiceShareText(inv: any, company?: any): string {
  if (!inv) return "";
  const coName = company?.name || company?.companyName || "Business";
  const invNo = inv.invoiceNumber || "-";
  const dateStr = formatDate(inv.date);
  const party = inv.partyName || "Supplier";
  const items: any[] = inv.items || [];

  const itemsList = items
    .slice(0, 10)
    .map((it: any) => `• ${it.itemName || "Item"} (${it.quantity} ${it.unit || ""}) - ${formatCurrency(Number(it.total || 0))}`)
    .join("\n");
  const moreItems = items.length > 10 ? `\n• ...and ${items.length - 10} more item(s)` : "";

  const grandTotal = formatCurrency(Number(inv.grandTotal || 0));
  const amountPaid = formatCurrency(Number(inv.amountPaid || 0));
  const balanceDue = formatCurrency(Number(inv.balanceDue || 0));

  const url = typeof window !== "undefined" ? `${window.location.origin}/purchase/invoices/${inv.id}` : "";

  return `🧾 *PURCHASE INVOICE #${invNo}*
*Company:* ${coName}
*Date:* ${dateStr}
*Supplier:* ${party}
${inv.supplierInvoiceNumber ? `*Supplier Inv#:* ${inv.supplierInvoiceNumber}\n` : ""}*Status:* ${(inv.status || "confirmed").toUpperCase()}

*Items:*
${itemsList || "• No items"}${moreItems}

*Grand Total:* ${grandTotal}
*Amount Paid:* ${amountPaid}
*Balance Due:* ${balanceDue}
${inv.notes ? `*Notes:* ${inv.notes}\n` : ""}${url ? `\n🔗 View Bill: ${url}` : ""}`.trim();
}

export function formatOrderShareText(order: any, type: "sale" | "purchase", company?: any): string {
  if (!order) return "";
  const coName = company?.name || company?.companyName || "Business";
  const orderNo = order.orderNumber || order.id || "-";
  const dateStr = formatDate(order.date);
  const party = order.partyName || (type === "sale" ? "Customer" : "Supplier");
  const items: any[] = order.items || [];

  const itemsList = items
    .slice(0, 10)
    .map((it: any) => `• ${it.itemName || "Item"} (${it.quantity} ${it.unit || ""}) - ${formatCurrency(Number(it.total || 0))}`)
    .join("\n");
  const moreItems = items.length > 10 ? `\n• ...and ${items.length - 10} more item(s)` : "";

  const grandTotal = formatCurrency(Number(order.grandTotal || 0));
  const typeLabel = type === "sale" ? "SALES ORDER" : "PURCHASE ORDER";
  const urlPath = type === "sale" ? "sales/orders" : "purchase/orders";
  const url = typeof window !== "undefined" ? `${window.location.origin}/${urlPath}` : "";

  return `📦 *${typeLabel} #${orderNo}*
*Company:* ${coName}
*Date:* ${dateStr}
*${type === "sale" ? "Customer" : "Supplier"}:* ${party}
*Status:* ${(order.status || "pending").toUpperCase()}

*Items:*
${itemsList || "• No items"}${moreItems}

*Grand Total:* ${grandTotal}
${order.notes ? `*Notes:* ${order.notes}\n` : ""}${url ? `\n🔗 View: ${url}` : ""}`.trim();
}
