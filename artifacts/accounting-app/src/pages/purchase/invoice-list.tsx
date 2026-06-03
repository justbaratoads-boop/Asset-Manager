import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListPurchaseInvoices, useDeletePurchaseInvoice, getListPurchaseInvoicesQueryKey, customFetch } from "@workspace/api-client-react";
import { useFetch } from "@/hooks/use-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Pencil, Trash2, Calendar, X, IndianRupee, Eye, FileText, Ban, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

/** Always returns the pre-GST base rate per unit, regardless of inclusive/exclusive. */
function itemBaseRate(item: any): number {
  const qty = Number(item.quantity) || 0;
  const discPct = Number(item.discountPct) || 0;
  const factor = 1 - discPct / 100;
  if (qty === 0 || factor === 0) return 0;
  return Number(item.taxableAmount) / qty / factor;
}

const PAGE_SIZE = 20;

const statusStyles: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUSES = ["all", "confirmed", "partial", "paid", "cancelled"];

function getBatchName(batchId: number | null | undefined, batches: any[]): string {
  if (!batchId) return "";
  const b = (batches || []).find((b: any) => b.id === Number(batchId));
  return b ? b.batchCode + (b.expiryDate ? ` · exp ${b.expiryDate}` : "") : `#${batchId}`;
}

function isEdited(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={`capitalize text-xs ${statusStyles[status] || ""}`}>{status || "confirmed"}</Badge>;
}

// ─── View Sheet ────────────────────────────────────────────────────────────────
function PurchaseInvoiceViewSheet({ id, onClose, onPayClick }: {
  id: number | null;
  onClose: () => void;
  onPayClick: (inv: any) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastId, setLastId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) { setData(null); setLastId(null); return; }
    if (id === lastId) return;
    setLastId(id);
    setLoading(true);
    setData(null);
    customFetch<any>(`/api/purchase-invoices/${id}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");
  const [bankAccounts, setBankAccounts] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    customFetch<any>("/api/ledgers?group=Bank%20Accounts").then((data: any) => {
      if (Array.isArray(data)) setBankAccounts(data.map((l: any) => ({ value: `bank_${l.id}`, label: l.name })));
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
            Purchase Invoice
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
              {data.supplierInvoiceNumber && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Supplier Inv#</span>
                  <span className="text-sm font-medium">{data.supplierInvoiceNumber}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Date</span>
                <span className="text-sm font-medium">{formatDate(data.date)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Supplier</span>
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
              {Number(data.balanceDue) > 0 && (
                <Button
                  variant="outline"
                  className="flex-1 text-green-700 border-green-300 hover:bg-green-50 gap-1"
                  onClick={() => { onClose(); onPayClick(data); }}
                >
                  <IndianRupee className="h-4 w-4" />Pay
                </Button>
              )}
              <Link href={`/purchase/invoices/${data.id}/edit`} className="flex-1">
                <Button className="w-full gap-2"><Pencil className="h-4 w-4" />Edit</Button>
              </Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Pay Dialog ────────────────────────────────────────────────────────────────
interface PayDialogProps {
  invoice: any;
  onClose: () => void;
  onPaid: () => void;
}

function PayDialog({ invoice, onClose, onPaid }: PayDialogProps) {
  const balance = Number(invoice.balanceDue) || 0;
  const [amount, setAmount] = useState(String(balance.toFixed(2)));
  const [mode, setMode] = useState("cash");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const [bankAccounts, setBankAccounts] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    customFetch<any>("/api/ledgers?group=Bank%20Accounts").then((data: any) => {
      if (Array.isArray(data)) setBankAccounts(data.map((l: any) => ({ value: `bank_${l.id}`, label: l.name })));
    }).catch(() => {});
  }, []);
  const allPaymentModes = [{ value: "cash", label: "Cash" }, ...bankAccounts];

  const handlePay = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
    if (amt > balance) { setError(`Cannot exceed balance due (${formatCurrency(balance)})`); return; }
    setLoading(true);
    try {
      await customFetch(`/api/purchase-invoices/${invoice.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, mode, reference }),
      });
      toast({ title: "Payment recorded successfully" });
      onPaid();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to record payment", description: err?.data?.error || "Please try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <div className="space-y-1 text-sm bg-muted/40 rounded-lg p-3">
          <p className="font-semibold">{invoice.partyName}</p>
          <p className="text-muted-foreground font-mono text-xs">{invoice.invoiceNumber}</p>
          <div className="flex justify-between mt-1">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{formatCurrency(invoice.grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Already Paid</span>
            <span className="text-green-600 font-medium">{formatCurrency(invoice.amountPaid)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Balance Due</span>
            <span className="text-red-600">{formatCurrency(balance)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Amount Paying *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
              <Input className="pl-7 h-10 text-base font-semibold" type="number" inputMode="decimal" min="0" step="any"
                value={amount} onChange={e => { setAmount(e.target.value); setError(""); }} />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAmount(String(balance.toFixed(2)))}
              className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70">Full Amount</button>
          </div>
          <div className="space-y-1">
            <Label>Payment Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{allPaymentModes.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Reference / Cheque No. (optional)</Label>
            <Input className="h-9 text-sm" placeholder="e.g. UTR, Cheque no." value={reference} onChange={e => setReference(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePay} disabled={loading}>{loading ? "Processing..." : "Record Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main List ─────────────────────────────────────────────────────────────────
export default function PurchaseInvoiceList() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [payInvoice, setPayInvoice] = useState<any | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const { data: invoices = [], isLoading } = useListPurchaseInvoices(({ search: search || undefined } as any));
  const deleteMutation = useDeletePurchaseInvoice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, statusFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
    setDeleteId(null);
    toast({ title: "Invoice deleted" });
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await customFetch(`/api/purchase-invoices/${cancelId}/cancel`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
      toast({ title: "Invoice cancelled" });
    } catch (err: any) {
      toast({ title: "Failed to cancel", description: err?.data?.error || "Please try again", variant: "destructive" });
    } finally { setCancelId(null); }
  };

  const handleUncancel = async (id: number) => {
    try {
      await customFetch(`/api/purchase-invoices/${id}/uncancel`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
      toast({ title: "Invoice restored" });
    } catch (err: any) {
      toast({ title: "Failed to restore", description: err?.data?.error || "Please try again", variant: "destructive" });
    }
  };

  const hasFilters = dateFrom || dateTo || statusFilter !== "all";
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); };

  const list = (invoices as any[]).filter(inv => {
    if (dateFrom && inv.date < dateFrom) return false;
    if (dateTo && inv.date > dateTo) return false;
    if (statusFilter !== "all" && (inv.status || "confirmed") !== statusFilter) return false;
    return true;
  });
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Purchase Invoices</h1>
          <p className="text-sm text-muted-foreground">{list.length} invoices</p>
        </div>
        <Link href="/purchase/invoices/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Invoice</Button></Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by supplier..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-muted/50 border rounded-lg px-3 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs bg-transparent outline-none w-32 cursor-pointer" />
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 border rounded-lg px-3 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs bg-transparent outline-none w-32 cursor-pointer" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/60"}`}>
              {s === "all" ? "All Status" : s}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted">
            <X className="h-3.5 w-3.5" />Clear
          </button>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No purchase invoices</div>
        ) : paginated.map((inv: any) => (
          <Card key={inv.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{inv.partyName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber} · {formatDate(inv.date)}</p>
                  {inv.supplierInvoiceNumber && <p className="text-xs text-muted-foreground">Supplier Inv: {inv.supplierInvoiceNumber}</p>}
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-base">{formatCurrency(inv.grandTotal)}</p>
                  <StatusBadge status={inv.status} />
                  {isEdited(inv.createdAt, inv.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200">Edited</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Paid</p><p className="font-semibold text-green-600">{formatCurrency(inv.amountPaid)}</p></div>
                <div><p className="text-xs text-muted-foreground">Balance Due</p><p className="font-semibold text-red-600">{formatCurrency(inv.balanceDue)}</p></div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewId(inv.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />View
                </Button>
                <Link href={`/purchase/invoices/${inv.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                {Number(inv.balanceDue) > 0 && inv.status !== "cancelled" && (
                  <Button size="sm" variant="outline" className="flex-1 text-green-600 border-green-200 hover:bg-green-50" onClick={() => setPayInvoice(inv)}>
                    <IndianRupee className="h-3.5 w-3.5 mr-1" />Pay
                  </Button>
                )}
                {inv.status === "cancelled" ? (
                  <Button size="sm" variant="outline" className="px-3 text-amber-600 border-amber-200 hover:bg-amber-50" title="Restore invoice" onClick={() => handleUncancel(inv.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="px-3 text-orange-600 border-orange-200 hover:bg-orange-50" title="Cancel invoice" onClick={() => setCancelId(inv.id)}>
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(inv.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="md:hidden">
        <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Supplier Inv#</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No purchase invoices</TableCell></TableRow>
              ) : paginated.map((inv: any) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewId(inv.id)}>
                  <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-medium">{inv.partyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.supplierInvoiceNumber || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(inv.amountPaid)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(inv.balanceDue)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      <StatusBadge status={inv.status} />
                      {isEdited(inv.createdAt, inv.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200">Edited</Badge>}
                    </div>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(inv.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/purchase/invoices/${inv.id}/edit`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      </Link>
                      {Number(inv.balanceDue) > 0 && inv.status !== "cancelled" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Record Payment" onClick={() => setPayInvoice(inv)}>
                          <IndianRupee className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {inv.status === "cancelled" ? (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" title="Restore invoice" onClick={() => handleUncancel(inv.id)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600" title="Cancel invoice" onClick={() => setCancelId(inv.id)}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(inv.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      {payInvoice && (
        <PayDialog
          invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onPaid={() => queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() })}
        />
      )}

      <PurchaseInvoiceViewSheet
        id={viewId}
        onClose={() => setViewId(null)}
        onPayClick={inv => setPayInvoice(inv)}
      />

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
      <ConfirmDialog open={!!cancelId} onOpenChange={o => !o && setCancelId(null)} onConfirm={handleCancel} title="Cancel invoice?" description="This will mark the invoice as cancelled. You can restore it later." confirmLabel="Cancel Invoice" />
    </div>
  );
}
