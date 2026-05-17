import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListPurchaseOrders, useDeletePurchaseOrder, getListPurchaseOrdersQueryKey, getListPurchaseInvoicesQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Pencil, Trash2, Calendar, X, Eye, PackageCheck, CheckCheck, ShoppingBag, Ban, RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

const statusStyles: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  partially_received: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  received: "Received",
  partially_received: "Partial",
  cancelled: "Cancelled",
};

const STATUSES = ["all", "open", "partially_received", "received", "cancelled"];

// ─── View Sheet ────────────────────────────────────────────────────────────────
function PurchaseOrderViewSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) { setData(null); return; }
    setLoading(true);
    setData(null);
    customFetch<any>(`/api/purchase-orders/${id}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  const items: any[] = data?.items || [];

  return (
    <Sheet open={!!id} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Purchase Order
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
                <span className="text-xs text-muted-foreground uppercase tracking-wide">PO Number</span>
                <span className="font-mono font-semibold text-sm">{data.poNumber}</span>
              </div>
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
                <Badge variant="outline" className={`capitalize text-xs ${statusStyles[data.status] || ""}`}>
                  {statusLabels[data.status] || data.status}
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
              <div className="rounded-lg border overflow-hidden">
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
                    {items.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{item.itemName}</p>
                          {item.gstPct > 0 && <p className="text-xs text-muted-foreground">GST {item.gstPct}%</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">{Number(item.quantity)} {item.unit}</td>
                        <td className="px-3 py-2.5 text-right">{formatCurrency(Number(item.rate))}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
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
              {data.status === "open" && id && (
                <Link href={`/purchase/orders/${id}/edit`} className="flex-1">
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

// ─── Receive Goods Dialog ──────────────────────────────────────────────────────
function ReceiveGoodsDialog({ id, onClose, onDone }: { id: number | null; onClose: () => void; onDone: (result: any) => void }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receivedQtys, setReceivedQtys] = useState<Record<number, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (!id) { setOrder(null); setReceivedQtys({}); return; }
    setLoading(true);
    setOrder(null);
    setReceivedQtys({});
    customFetch<any>(`/api/purchase-orders/${id}`)
      .then(d => {
        setOrder(d);
        const defaults: Record<number, string> = {};
        (d.items || []).forEach((item: any) => { defaults[item.id] = ""; });
        setReceivedQtys(defaults);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  const items: any[] = order?.items || [];

  const handleSelectAll = () => {
    const all: Record<number, string> = {};
    items.forEach((item: any) => { all[item.id] = String(Number(item.quantity)); });
    setReceivedQtys(all);
  };

  const handleClear = () => {
    const cleared: Record<number, string> = {};
    items.forEach((item: any) => { cleared[item.id] = ""; });
    setReceivedQtys(cleared);
  };

  const handleSave = async () => {
    if (!id) return;
    const payload = items.map((item: any) => ({
      itemId: item.id,
      receivedQty: Number(receivedQtys[item.id]) || 0,
    }));
    const anyReceived = payload.some(p => p.receivedQty > 0);
    if (!anyReceived) {
      toast({ title: "Enter received quantity for at least one item", variant: "destructive" });
      return;
    }
    // Validate received qty ≤ ordered qty
    for (const item of items) {
      const rqty = Number(receivedQtys[item.id]) || 0;
      if (rqty > Number(item.quantity)) {
        toast({ title: `"${item.itemName}": received qty cannot exceed ordered qty (${Number(item.quantity)} ${item.unit})`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const result = await customFetch<any>(`/api/purchase-orders/${id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      onDone(result);
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to record receipt", description: err?.data?.error || "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalReceived = items.reduce((s, item) => s + (Number(receivedQtys[item.id]) || 0) * Number(item.rate), 0);

  return (
    <Dialog open={!!id} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-green-600" />
            Receive Goods
            {order && <span className="text-muted-foreground font-normal text-sm ml-1">— {order.poNumber}</span>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading order items...</div>
        ) : !order ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Order not found</div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm bg-muted/40 rounded-lg px-3 py-2">
              <span className="font-semibold">{order.partyName}</span>
              <span className="text-muted-foreground ml-2">· {formatDate(order.date)}</span>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Enter how many items you received</p>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50" onClick={handleSelectAll}>
                  <CheckCheck className="h-3.5 w-3.5" />All Received
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={handleClear}>Clear</Button>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Item</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground">Ordered</th>
                    <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground w-28">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item: any) => {
                    const orderedQty = Number(item.quantity);
                    const rqty = Number(receivedQtys[item.id]) || 0;
                    const isOver = rqty > orderedQty;
                    const isFull = rqty === orderedQty && rqty > 0;
                    return (
                      <tr key={item.id} className={isFull ? "bg-green-50" : ""}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{item.itemName}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(Number(item.rate))} / {item.unit}</p>
                        </td>
                        <td className="px-2 py-2.5 text-center text-muted-foreground text-sm">
                          {orderedQty} {item.unit}
                        </td>
                        <td className="px-2 py-2.5">
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={orderedQty}
                            step="any"
                            value={receivedQtys[item.id] ?? ""}
                            onChange={e => setReceivedQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                            className={`h-8 text-center text-sm ${isOver ? "border-destructive" : isFull ? "border-green-400 bg-green-50" : ""}`}
                            placeholder="0"
                          />
                          {isOver && <p className="text-xs text-destructive mt-0.5 text-center">Max {orderedQty}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalReceived > 0 && (
              <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Invoice will be created for</span>
                  <span className="text-primary">{formatCurrency(totalReceived)}</span>
                </div>
                <p className="text-xs text-muted-foreground">A purchase invoice is auto-generated upon saving</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading || !order}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <PackageCheck className="h-4 w-4" />
            {saving ? "Saving..." : "Save Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main List ─────────────────────────────────────────────────────────────────
export default function PurchaseOrderList() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [receiveId, setReceiveId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const { data: orders = [], isLoading } = useListPurchaseOrders({});
  const deleteMutation = useDeletePurchaseOrder();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    setDeleteId(null);
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await customFetch(`/api/purchase-orders/${cancelId}/cancel`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
      toast({ title: "Purchase order cancelled" });
    } catch (err: any) {
      toast({ title: "Failed to cancel", description: err?.data?.error || "Please try again", variant: "destructive" });
    } finally { setCancelId(null); }
  };

  const handleUncancel = async (id: number) => {
    try {
      await customFetch(`/api/purchase-orders/${id}/uncancel`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
      toast({ title: "Purchase order restored to open" });
    } catch (err: any) {
      toast({ title: "Failed to restore", description: err?.data?.error || "Please try again", variant: "destructive" });
    }
  };

  const handleReceiveDone = (result: any) => {
    queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
    const isPartial = result.status === "partially_received";
    toast({
      title: isPartial ? "Partially received — invoice created" : "Goods received — invoice created",
      description: `Purchase invoice ${result.invoiceNumber} has been generated`,
    });
  };

  const hasFilters = dateFrom || dateTo || statusFilter !== "all";
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); };

  const list = (orders as any[]).filter(o => {
    if (search && !o.partyName.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && o.date < dateFrom) return false;
    if (dateTo && o.date > dateTo) return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    return true;
  });
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const canReceive = (status: string) => status === "open" || status === "partially_received";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">{list.length} orders</p>
        </div>
        <Link href="/purchase/orders/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New PO</Button></Link>
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
              {s === "all" ? "All" : statusLabels[s] || s}
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
          <div className="text-center text-muted-foreground py-10">No purchase orders</div>
        ) : paginated.map((o: any) => (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{o.partyName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{o.poNumber} · {formatDate(o.date)}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-base">{formatCurrency(o.grandTotal)}</p>
                  <Badge variant="outline" className={`capitalize text-xs ${statusStyles[o.status] || ""}`}>
                    {statusLabels[o.status] || o.status}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewId(o.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />View
                </Button>
                <Link href={`/purchase/orders/${o.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                {canReceive(o.status) && (
                  <Button size="sm" variant="outline" className="flex-1 text-green-600 border-green-200 hover:bg-green-50" onClick={() => setReceiveId(o.id)}>
                    <PackageCheck className="h-3.5 w-3.5 mr-1" />Receive
                  </Button>
                )}
                {o.status === "cancelled" ? (
                  <Button size="sm" variant="outline" className="px-3 text-amber-600 border-amber-200 hover:bg-amber-50" title="Restore order" onClick={() => handleUncancel(o.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="px-3 text-orange-600 border-orange-200 hover:bg-orange-50" title="Cancel order" onClick={() => setCancelId(o.id)}>
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(o.id)}>
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
                <TableHead>PO#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No purchase orders</TableCell></TableRow>
              ) : paginated.map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewId(o.id)}>
                  <TableCell className="font-mono text-sm">{o.poNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(o.date)}</TableCell>
                  <TableCell className="font-medium">{o.partyName}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(o.grandTotal)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize text-xs ${statusStyles[o.status] || ""}`}>
                      {statusLabels[o.status] || o.status}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(o.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/purchase/orders/${o.id}/edit`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      </Link>
                      {canReceive(o.status) && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Receive Goods" onClick={() => setReceiveId(o.id)}>
                          <PackageCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {o.status === "cancelled" ? (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-amber-600" title="Restore order" onClick={() => handleUncancel(o.id)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-orange-600" title="Cancel order" onClick={() => setCancelId(o.id)}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(o.id)}>
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

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
      <ConfirmDialog open={!!cancelId} onOpenChange={o => !o && setCancelId(null)} onConfirm={handleCancel} title="Cancel purchase order?" description="This will mark the order as cancelled. You can restore it later." confirmLabel="Cancel Order" />

      <PurchaseOrderViewSheet id={viewId} onClose={() => setViewId(null)} />

      <ReceiveGoodsDialog
        id={receiveId}
        onClose={() => setReceiveId(null)}
        onDone={handleReceiveDone}
      />
    </div>
  );
}
