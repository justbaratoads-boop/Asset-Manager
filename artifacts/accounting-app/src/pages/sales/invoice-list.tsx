import { useState, useEffect } from "react";
import { useListSaleInvoices, useDeleteSaleInvoice, getListSaleInvoicesQueryKey, useGetCompanySettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { customFetch } from "@workspace/api-client-react";
import { useFetch } from "@/hooks/use-fetch";
import { FileText, Printer } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Eye, Pencil, Trash2, Calendar, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

/** Always returns the pre-GST base rate per unit, regardless of inclusive/exclusive. */
function itemBaseRate(item: any): number {
  const rate = Number(item.rate) || 0;
  const gstPct = Number(item.gstPct) || 0;
  // Read gstInclusive directly from DB — no heuristic needed
  const isInclusive = (item.gstInclusive === true || item.gstInclusive === "true") && gstPct > 0;
  return isInclusive ? Number((rate / (1 + gstPct / 100)).toFixed(2)) : rate;
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
  return b ? b.name + (b.expiryDate ? ` - exp ${b.expiryDate}` : "") : `#${batchId}`;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={`capitalize text-xs ${statusStyles[status] || ""}`}>{status}</Badge>;
}

function isEdited(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
}


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
    customFetch<any>(`/api/sale-invoices/${id}`)
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

  const otherChargesList: any[] = (() => {
    try { return JSON.parse(data?.otherCharges || "[]"); } catch { return []; }
  })();

  // Use pre-tax base amounts (matching gst.ts) to apportion assessable charges
  const totalItemValue = items.reduce((sum: number, i: any) => {
    const qty = Number(i.quantity) || 0;
    const rate = Number(i.rate) || 0;
    const disc = Number(i.discountPct) || 0;
    const gstPct = Number(i.gstPct) || 0;
    const baseRate = i.gstInclusive && gstPct > 0 ? Number((rate / (1 + gstPct / 100)).toFixed(2)) : rate;
    return sum + qty * baseRate * (1 - disc / 100);
  }, 0) || 0;

  const assessableCharges = otherChargesList.filter((c: any) => c.gstCalculationMethod === 'assessable_value');
  const totalAssessableAmount = assessableCharges.reduce((sum: number, c: any) => sum + (c.type === 'deduct' ? -Number(c.amount) : Number(c.amount)), 0);
  const baseTaxableTotal = Number(data?.totalTaxable || 0) - totalAssessableAmount;

  const isInterstate = data?.isInterstate === true || data?.isInterstate === "true";
  let _baseCgst = 0, _baseSgst = 0, _baseIgst = 0;
  items.forEach((item: any) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const discPct = Number(item.discountPct) || 0;
    const gstPct = Number(item.gstPct) || 0;
    const baseRate = item.gstInclusive && gstPct > 0 ? Number((rate / (1 + gstPct / 100)).toFixed(2)) : rate;
    const baseAmount = qty * baseRate * (1 - discPct / 100);
    const apportioned = totalItemValue > 0 ? (baseAmount / totalItemValue) * totalAssessableAmount : 0;
    const baseTaxableAmount = Number(item.taxableAmount || 0) - apportioned;
    if (isInterstate) {
      _baseIgst += Number(((baseTaxableAmount * gstPct) / 100).toFixed(2));
    } else {
      _baseCgst += Number(((baseTaxableAmount * (gstPct / 2)) / 100).toFixed(2));
      _baseSgst += Number(((baseTaxableAmount * (gstPct / 2)) / 100).toFixed(2));
    }
  });
  const baseCgst = Number(_baseCgst.toFixed(2));
  const baseSgst = Number(_baseSgst.toFixed(2));
  const baseIgst = Number(_baseIgst.toFixed(2));

  const displayCgst = Number(data?.totalCgst || 0);
  const displaySgst = Number(data?.totalSgst || 0);
  const displayIgst = Number(data?.totalIgst || 0);

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
              <div className="rounded-lg border overflow-x-auto">
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
                    {items.map((item: any, i: number) => {
                      const qty = Number(item.quantity) || 0;
                      const rate = Number(item.rate) || 0;
                      const discPct = Number(item.discountPct) || 0;
                      const factor = 1 - discPct / 100;
                      const gstPct = Number(item.gstPct) || 0;
                      // Use pre-tax base rate for apportionment (same as totalItemValue above)
                       const isInclusive = (item.gstInclusive === true || item.gstInclusive === "true") && gstPct > 0;
                      const baseRate = isInclusive ? Number((rate / (1 + gstPct / 100)).toFixed(2)) : rate;
                      const baseAmount = qty * baseRate * factor;

                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{item.itemName}</p>
                            {item.batchId && <p className="text-xs text-blue-600 font-medium">{getBatchName(item.batchId, batches)}</p>}
                            {Number(item.gstPct) > 0 && <p className="text-xs text-muted-foreground">GST {item.gstPct}%</p>}
                          </td>
                          <td className="px-2 py-2.5 text-right text-muted-foreground whitespace-nowrap">{Number(item.quantity)} {item.unit}</td>
                          <td className="px-2 py-2.5 text-right whitespace-nowrap">{formatCurrency(itemBaseRate(item))}</td>
                          <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{formatCurrency(baseAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="rounded-lg border bg-muted/30 divide-y text-sm">
              {Number(data.totalTaxable) > 0 && (
                <div className="flex justify-between px-4 py-2">
                  <span className="text-muted-foreground">Taxable</span>
                  <span>{formatCurrency(baseTaxableTotal)}</span>
                </div>
              )}
              {(() => {
                const nonRoundOff = otherChargesList.filter((c: any) => (c.name || c.ledgerName || "").toLowerCase() !== "round off");
                const roundOff = otherChargesList.find((c: any) => (c.name || c.ledgerName || "").toLowerCase() === "round off");

                return (
                  <>
                    {nonRoundOff.map((c: any, i: number) => (
                      <div key={i} className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">{c.name || c.ledgerName || "Other Charges"}</span>
                        <span>{c.type === "deduct" ? "- " : "+ "}{formatCurrency(Number(c.amount))}</span>
                      </div>
                    ))}
                    {displayCgst > 0 && (
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">CGST</span>
                        <span>+ {formatCurrency(displayCgst)}</span>
                      </div>
                    )}
                    {displaySgst > 0 && (
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">SGST</span>
                        <span>+ {formatCurrency(displaySgst)}</span>
                      </div>
                    )}
                    {displayIgst > 0 && (
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">IGST</span>
                        <span>+ {formatCurrency(displayIgst)}</span>
                      </div>
                    )}
                    {roundOff && (
                      <div className="flex justify-between px-4 py-2">
                        <span className="text-muted-foreground">{roundOff.name || roundOff.ledgerName}</span>
                        <span>{roundOff.type === "deduct" ? "- " : "+ "}{formatCurrency(Number(roundOff.amount))}</span>
                      </div>
                    )}
                  </>
                );
              })()}
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
              <Link href={`/sales/invoices/${data.id}?print=1`} className="flex-1">
                <Button variant="outline" className="w-full gap-2"><Printer className="h-4 w-4" />Print</Button>
              </Link>
              <Link href={`/sales/invoices/${data.id}/edit`} className="flex-1">
                <Button className="w-full gap-2"><Pencil className="h-4 w-4" />Edit</Button>
              </Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function SaleInvoiceList() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const { data: companySettings } = useGetCompanySettings();
  const enableDualLedger = (companySettings as any)?.enableDualLedger ?? false;
  const { data: invoices = [], isLoading } = useListSaleInvoices({ search: search || undefined });
  const deleteMutation = useDeleteSaleInvoice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, statusFilter, ledgerFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListSaleInvoicesQueryKey() });
    toast({ title: "Invoice deleted" });
    setDeleteId(null);
  };

  const hasFilters = dateFrom || dateTo || statusFilter !== "all" || ledgerFilter !== "all";
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); setLedgerFilter("all"); };

  const list = (invoices as any[]).filter(inv => {
    if (dateFrom && inv.date < dateFrom) return false;
    if (dateTo && inv.date > dateTo) return false;
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    
    if (!enableDualLedger && inv.isKaccha) return false;
    if (enableDualLedger && ledgerFilter === "pakka" && inv.isKaccha) return false;
    if (enableDualLedger && ledgerFilter === "kaccha" && !inv.isKaccha) return false;
    
    return true;
  });
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Sale Invoices</h1>
          <p className="text-sm text-muted-foreground">{list.length} invoices</p>
        </div>
        <Link href="/sales/invoices/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Invoice</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by party name..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filters */}
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

        {enableDualLedger && (
          <div className="flex gap-1 ml-auto bg-muted/30 p-1 rounded-lg border">
            {["all", "pakka", "kaccha"].map(s => (
              <button
                key={s}
                onClick={() => setLedgerFilter(s)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${ledgerFilter === s ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {hasFilters && (
          <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5" />Clear
          </button>
        )}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No invoices found</div>
        ) : paginated.map((inv: any) => (
          <Card key={inv.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{inv.partyName || "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber} · {formatDate(inv.date)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={inv.status} />
                  {isEdited(inv.createdAt, inv.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200">Edited</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold">{formatCurrency(inv.grandTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-semibold text-green-600">{formatCurrency(inv.amountPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-semibold text-red-600">{formatCurrency(inv.balanceDue)}</p>
                </div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Link href={`/sales/invoices/${inv.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewId(inv.id)}><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
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
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No invoices found</TableCell></TableRow>
              ) : paginated.map((inv: any) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewId(inv.id)}>
                  <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-medium">{inv.partyName}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(inv.amountPaid)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(inv.balanceDue)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge status={inv.status} />
                      {isEdited(inv.createdAt, inv.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200">Edited</Badge>}
                    </div>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Link href={`/sales/invoices/${inv.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(inv.id)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(inv.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} title="Delete Invoice?" description="This will permanently delete the invoice." onConfirm={handleDelete} loading={deleteMutation.isPending} />
    
      <SaleInvoiceViewSheet id={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}
