import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExternalLink, Printer, Edit, Calendar, User, FileText, CreditCard, Building2 } from "lucide-react";
import { Link } from "wouter";

const TYPE_CONFIG: Record<string, { label: string; color: string; endpoint: string; fullPath: (id: number) => string }> = {
  "Sale Invoice": {
    label: "Sale Invoice",
    color: "bg-green-100 text-green-800 border-green-300",
    endpoint: "/api/sale-invoices",
    fullPath: (id) => `/sales/invoices/${id}`,
  },
  "sale_invoice": {
    label: "Sale Invoice",
    color: "bg-green-100 text-green-800 border-green-300",
    endpoint: "/api/sale-invoices",
    fullPath: (id) => `/sales/invoices/${id}`,
  },
  "Purchase Invoice": {
    label: "Purchase Invoice",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    endpoint: "/api/purchase-invoices",
    fullPath: (id) => `/purchase/invoices/${id}/edit`,
  },
  "purchase_invoice": {
    label: "Purchase Invoice",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    endpoint: "/api/purchase-invoices",
    fullPath: (id) => `/purchase/invoices/${id}/edit`,
  },
  "Payment": {
    label: "Payment Voucher",
    color: "bg-red-100 text-red-800 border-red-300",
    endpoint: "/api/payments",
    fullPath: (id) => `/accounts/payments/${id}/edit`,
  },
  "payment": {
    label: "Payment Voucher",
    color: "bg-red-100 text-red-800 border-red-300",
    endpoint: "/api/payments",
    fullPath: (id) => `/accounts/payments/${id}/edit`,
  },
  "Receipt": {
    label: "Receipt Voucher",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    endpoint: "/api/receipts",
    fullPath: (id) => `/accounts/receipts/${id}/edit`,
  },
  "receipt": {
    label: "Receipt Voucher",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    endpoint: "/api/receipts",
    fullPath: (id) => `/accounts/receipts/${id}/edit`,
  },
  "Journal": {
    label: "Journal Entry",
    color: "bg-purple-100 text-purple-800 border-purple-300",
    endpoint: "/api/journals",
    fullPath: (id) => `/accounts/journal/${id}/edit`,
  },
  "journal": {
    label: "Journal Entry",
    color: "bg-purple-100 text-purple-800 border-purple-300",
    endpoint: "/api/journals",
    fullPath: (id) => `/accounts/journal/${id}/edit`,
  },
  "Order": {
    label: "Sales Order",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    endpoint: "/api/orders",
    fullPath: (id) => `/sales/orders/${id}`,
  },
  "order": {
    label: "Sales Order",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    endpoint: "/api/orders",
    fullPath: (id) => `/sales/orders/${id}`,
  },
  "Credit Note": {
    label: "Credit Note",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    endpoint: "/api/credit-notes",
    fullPath: (id) => `/accounts/credit-notes/${id}`,
  },
  "credit_note": {
    label: "Credit Note",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    endpoint: "/api/credit-notes",
    fullPath: (id) => `/accounts/credit-notes/${id}`,
  },
  "Debit Note": {
    label: "Debit Note",
    color: "bg-pink-100 text-pink-800 border-pink-300",
    endpoint: "/api/debit-notes",
    fullPath: (id) => `/accounts/debit-notes/${id}`,
  },
  "debit_note": {
    label: "Debit Note",
    color: "bg-pink-100 text-pink-800 border-pink-300",
    endpoint: "/api/debit-notes",
    fullPath: (id) => `/accounts/debit-notes/${id}`,
  },
};

export interface TransactionTarget {
  type: string;
  id: number;
  number?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionTarget | null;
}

export function TransactionDetailSheet({ open, onOpenChange, transaction }: Props) {
  const typeKey = transaction?.type || "";
  const cfg = TYPE_CONFIG[typeKey] || {
    label: typeKey || "Transaction",
    color: "bg-gray-100 text-gray-800",
    endpoint: "",
    fullPath: () => "#",
  };

  const { data: detail, isLoading } = useQuery({
    queryKey: ["transaction-detail", typeKey, transaction?.id],
    queryFn: async () => {
      if (!transaction?.id || !cfg.endpoint) return null;
      return await customFetch<any>(`${cfg.endpoint}/${transaction.id}`);
    },
    enabled: !!open && !!transaction?.id && !!cfg.endpoint,
  });

  const d = detail as any;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto p-6">
        {!transaction ? (
          <div className="py-12 text-center text-muted-foreground">No transaction selected</div>
        ) : isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading transaction details...</div>
        ) : !d ? (
          <div className="py-12 text-center text-muted-foreground">Failed to load details</div>
        ) : (
          <div className="space-y-6">
            {/* Header / Title */}
            <div className="border-b pb-4">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <Badge variant="outline" className={`font-semibold px-2.5 py-0.5 ${cfg.color}`}>
                  {cfg.label}
                </Badge>
                {d.isKaccha && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                    Estimate / Kaccha
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-mono">ID #{transaction.id}</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">
                {d.invoiceNumber || d.voucherNumber || d.orderNumber || d.noteNumber || transaction.number || `Voucher #${transaction.id}`}
              </h2>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Date: <strong className="text-foreground">{formatDate(d.date)}</strong></span>
                </div>
                {(d.partyName || d.party?.name) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span>Party: <strong className="text-foreground">{d.partyName || d.party?.name}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Sale / Purchase Invoice or Order Details */}
            {(typeKey.includes("Sale") || typeKey.includes("Purchase") || typeKey.includes("Order") || typeKey.includes("sale") || typeKey.includes("purchase")) && (
              <div className="space-y-4">
                {d.items?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Item Details</h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-12 text-center">#</TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-center">HSN</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">GST %</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {d.items.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="font-medium text-sm">{item.itemName || item.item?.name}</TableCell>
                              <TableCell className="text-center text-xs font-mono">{item.hsnCode || item.item?.hsnCode || "-"}</TableCell>
                              <TableCell className="text-right text-sm">{item.quantity || item.qty} {item.unit || ""}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(item.rate)}</TableCell>
                              <TableCell className="text-right text-sm">{item.gstPct || item.gstRate || 0}%</TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatCurrency(item.total || item.totalAmount || item.taxableAmount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Summary Box */}
                <div className="bg-muted/30 border rounded-lg p-4 space-y-2 text-sm ml-auto max-w-sm">
                  {d.subtotal && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal:</span>
                      <span className="font-medium text-foreground">{formatCurrency(d.subtotal)}</span>
                    </div>
                  )}
                  {Number(d.totalCgst) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>CGST:</span>
                      <span>{formatCurrency(d.totalCgst)}</span>
                    </div>
                  )}
                  {Number(d.totalSgst) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>SGST:</span>
                      <span>{formatCurrency(d.totalSgst)}</span>
                    </div>
                  )}
                  {Number(d.totalIgst) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>IGST:</span>
                      <span>{formatCurrency(d.totalIgst)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t pt-2 mt-2">
                    <span>Grand Total:</span>
                    <span className="text-primary">{formatCurrency(d.grandTotal || d.totalAmount || 0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment & Receipt Details */}
            {(typeKey.includes("Payment") || typeKey.includes("Receipt") || typeKey.includes("payment") || typeKey.includes("receipt")) && (
              <div className="space-y-4">
                <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(d.amount)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                    <div>
                      <span className="text-xs text-muted-foreground block">Payment Mode</span>
                      <span className="font-medium capitalize">{d.paymentMode || "Cash"}</span>
                    </div>
                    {d.reference && (
                      <div>
                        <span className="text-xs text-muted-foreground block">Reference #</span>
                        <span className="font-mono text-xs">{d.reference}</span>
                      </div>
                    )}
                  </div>
                  {d.narration && (
                    <div className="pt-2 border-t text-sm">
                      <span className="text-xs text-muted-foreground block">Narration</span>
                      <p className="text-slate-700 italic">{d.narration}</p>
                    </div>
                  )}
                </div>

                {/* Ledger Allocation Breakdown */}
                {(() => {
                  let allocs: any[] = [];
                  if (d.ledgerAllocations) {
                    try { allocs = JSON.parse(d.ledgerAllocations); } catch {}
                  }
                  if (!allocs.length) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Ledger Allocations</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>Ledger Account</TableHead>
                              <TableHead className="text-right">Allocated Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allocs.map((a: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-sm">{a.ledgerName || `Ledger #${a.ledgerId}`}</TableCell>
                                <TableCell className="text-right font-medium text-sm">{formatCurrency(a.amount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Journal Details */}
            {(typeKey.includes("Journal") || typeKey.includes("journal")) && (
              <div className="space-y-4">
                {d.narration && (
                  <div className="bg-muted/30 border rounded-lg p-3 text-sm">
                    <span className="text-xs text-muted-foreground block">Narration</span>
                    <p className="italic">{d.narration}</p>
                  </div>
                )}
                {d.lines?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Journal Entries</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Ledger Account</TableHead>
                            <TableHead className="text-right">Debit (Dr)</TableHead>
                            <TableHead className="text-right">Credit (Cr)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {d.lines.map((l: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-sm">{l.ledgerName || l.ledger?.name || `Ledger #${l.ledgerId}`}</TableCell>
                              <TableCell className="text-right font-medium text-sm">{l.type === "dr" ? formatCurrency(l.amount) : ""}</TableCell>
                              <TableCell className="text-right font-medium text-sm">{l.type === "cr" ? formatCurrency(l.amount) : ""}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Credit / Debit Note Details */}
            {(typeKey.includes("Note") || typeKey.includes("note")) && (
              <div className="space-y-4">
                <div className="bg-muted/30 border rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Note Amount</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(d.amount)}</span>
                  </div>
                  {d.reason && (
                    <div className="pt-2 border-t">
                      <span className="text-xs text-muted-foreground block">Reason</span>
                      <p className="italic">{d.reason}</p>
                    </div>
                  )}
                </div>

                {d.items?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Item Details</h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {d.items.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-sm">{item.itemName || item.item?.name}</TableCell>
                              <TableCell className="text-right text-sm">{item.quantity} {item.unit || ""}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(item.rate)}</TableCell>
                              <TableCell className="text-right font-medium text-sm">{formatCurrency(item.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions Footer */}
            <div className="border-t pt-4 flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>

              <Link href={cfg.fullPath(transaction.id)}>
                <Button className="gap-2" onClick={() => onOpenChange(false)}>
                  <ExternalLink className="h-4 w-4" /> Open Full Details / Edit
                </Button>
              </Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
