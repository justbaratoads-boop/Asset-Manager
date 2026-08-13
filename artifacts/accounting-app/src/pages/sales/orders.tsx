// @ts-nocheck
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useListOrders, useDeleteOrder, getListOrdersQueryKey, customFetch, useGetCompanySettings } from "@workspace/api-client-react";
import { useFetch } from "@/hooks/use-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Pencil, Trash2, FileText, Calendar, X, Ban, RotateCcw, Eye, ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  dispatched: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUSES = ["all", "pending", "confirmed", "dispatched", "delivered", "cancelled"];

function isEdited(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
}

function SalesOrderViewSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");

  useEffect(() => {
    if (!id) { setData(null); return; }
    setLoading(true);
    setData(null);
    customFetch<any>(`/api/orders/${id}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const items: any[] = data?.items || [];

  const getBatchName = (batchId: number | null) => {
    if (!batchId) return null;
    const b = (batches as any[]).find((b: any) => b.id === batchId);
    return b ? b.name : `Batch #${batchId}`;
  };

  return (
    <Sheet open={!!id} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Sales Order
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
        ) : !data ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Not found</div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border bg-muted/30 divide-y">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Order Number</span>
                <span className="font-mono font-semibold text-sm">{data.orderNumber}</span>
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
                <Badge variant="outline" className={`capitalize text-xs ${statusColors[data.status] || ""}`}>
                  {data.status}
                </Badge>
              </div>
              {data.notes && (
                <div className="px-4 py-2.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm">{data.notes}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items</p>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Item</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Rate</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item: any, i: number) => {
                      const batchName = getBatchName(item.batchId);
                      const gstPct = Number(item.gstPct);
                      const discPct = Number(item.discountPct);
                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{item.itemName}</p>
                            {batchName && <p className="text-xs text-blue-600 font-medium">Batch: {batchName}</p>}
                            {gstPct > 0 && <p className="text-xs text-muted-foreground">GST {gstPct}%{discPct > 0 ? ` · Disc ${discPct}%` : ""}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(item.quantity)} {item.unit}</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(Number(item.rate))}</td>
                          <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(Number(item.total))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-bold">
                      <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Grand Total</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(data.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
              {data.status === "pending" && id && (
                <Link href={`/sales/orders/${id}`} className="flex-1">
                  <Button className="w-full gap-2"><Pencil className="h-4 w-4" />Edit Order</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function OrderList() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const [, setLocation] = useLocation();
  const { data: companySettings } = useGetCompanySettings();
  const enableDualLedger = (companySettings as any)?.enableDualLedger ?? false;
  const { data: orders = [], isLoading } = useListOrders({ search: search || undefined });
  const deleteMutation = useDeleteOrder();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, statusFilter, ledgerFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    setDeleteId(null);
    toast({ title: "Order deleted" });
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await customFetch(`/api/orders/${cancelId}/cancel`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Order cancelled" });
    } catch (err: any) {
      toast({ title: "Failed to cancel order", description: err?.data?.error || "Please try again", variant: "destructive" });
    } finally { setCancelId(null); }
  };

  const handleUncancel = async (id: number) => {
    try {
      await customFetch(`/api/orders/${id}/uncancel`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Order restored to pending" });
    } catch (err: any) {
      toast({ title: "Failed to restore order", description: err?.data?.error || "Please try again", variant: "destructive" });
    }
  };

  const hasFilters = dateFrom || dateTo || statusFilter !== "all" || ledgerFilter !== "all";
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); setLedgerFilter("all"); };

  const list = (orders as any[]).filter(order => {
    if (dateFrom && order.date < dateFrom) return false;
    if (dateTo && order.date > dateTo) return false;
    if (statusFilter !== "all" && order.status !== statusFilter) return false;

    if (!enableDualLedger && order.isKaccha) return false;
    if (enableDualLedger && ledgerFilter === "pakka" && order.isKaccha) return false;
    if (enableDualLedger && ledgerFilter === "kaccha" && !order.isKaccha) return false;

    return true;
  });
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Order Booking</h1>
          <p className="text-sm text-muted-foreground">{list.length} orders</p>
        </div>
        <Link href="/sales/orders/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Order</Button></Link>
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
          <div className="text-center text-muted-foreground py-10">No orders found</div>
        ) : paginated.map((order: any) => (
          <Card key={order.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{order.partyName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{order.orderNumber} · {formatDate(order.date)}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-base">{formatCurrency(order.grandTotal)}</p>
                  <Badge variant="outline" className={`capitalize text-xs ${statusColors[order.status] || ""}`}>{order.status}</Badge>
                  {isEdited(order.createdAt, order.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 ml-1">Edited</Badge>}
                </div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewId(order.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />View
                </Button>
                <Link href={`/sales/orders/${order.id}`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                {order.status === "pending" && (
                  <Button size="sm" variant="outline" className="flex-1 text-blue-600 border-blue-200" onClick={() => setLocation(`/sales/invoices/new?fromOrder=${order.id}`)}>
                    <FileText className="h-3.5 w-3.5 mr-1" />Invoice
                  </Button>
                )}
                {order.status === "cancelled" ? (
                  <Button size="sm" variant="outline" className="px-3 text-amber-600 border-amber-200 hover:bg-amber-50" title="Restore order" onClick={() => handleUncancel(order.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="px-3 text-orange-600 border-orange-200 hover:bg-orange-50" title="Cancel order" onClick={() => setCancelId(order.id)}>
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(order.id)}>
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
                <TableHead>Order#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No orders found</TableCell></TableRow>
              ) : paginated.map((order: any) => (
                <TableRow key={order.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewId(order.id)}>
                  <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(order.date)}</TableCell>
                  <TableCell className="font-medium">{order.partyName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.grandTotal)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`capitalize ${statusColors[order.status] || ""}`}>{order.status}</Badge>
                      {isEdited(order.createdAt, order.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200">Edited</Badge>}
                    </div>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(order.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/sales/orders/${order.id}`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      {order.status === "pending" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" title="Create Invoice" onClick={() => setLocation(`/sales/invoices/new?fromOrder=${order.id}`)}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {order.status === "cancelled" ? (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" title="Restore order" onClick={() => handleUncancel(order.id)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600" title="Cancel order" onClick={() => setCancelId(order.id)}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(order.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>
      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
      <ConfirmDialog open={!!cancelId} onOpenChange={o => !o && setCancelId(null)} onConfirm={handleCancel} title="Cancel order?" description="This will mark the order as cancelled. You can restore it later." confirmLabel="Cancel Order" />
      <SalesOrderViewSheet id={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}
