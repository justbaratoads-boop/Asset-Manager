import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListPurchaseOrders, useDeletePurchaseOrder, useReceivePurchaseOrder, getListPurchaseOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Pencil, Trash2, CheckCircle, Calendar, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

const statusStyles: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUSES = ["all", "open", "received", "cancelled"];

export default function PurchaseOrderList() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const { data: orders = [], isLoading } = useListPurchaseOrders({});
  const deleteMutation = useDeletePurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, statusFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    setDeleteId(null);
  };

  const handleReceive = async (id: number) => {
    await receiveMutation.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
    toast({ title: "Purchase order marked as received" });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">{list.length} orders</p>
        </div>
        <Link href="/purchase/orders/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New PO</Button></Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by supplier..." value={search} onChange={e => setSearch(e.target.value)} />
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
          <div className="text-center text-muted-foreground py-10">No purchase orders</div>
        ) : paginated.map((o: any) => (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{o.partyName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{o.poNumber} · {formatDate(o.date)}</p>
                  {o.deliveryDate && <p className="text-xs text-muted-foreground">Delivery: {formatDate(o.deliveryDate)}</p>}
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-base">{formatCurrency(o.grandTotal)}</p>
                  <Badge variant="outline" className={`capitalize text-xs ${statusStyles[o.status] || ""}`}>{o.status}</Badge>
                </div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Link href={`/purchase/orders/${o.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                {o.status === "open" && (
                  <Button size="sm" variant="outline" className="flex-1 text-green-600 border-green-200" onClick={() => handleReceive(o.id)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />Receive
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
                <TableHead>Delivery Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No purchase orders</TableCell></TableRow>
              ) : paginated.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.poNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(o.date)}</TableCell>
                  <TableCell className="font-medium">{o.partyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.deliveryDate ? formatDate(o.deliveryDate) : "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.grandTotal)}</TableCell>
                  <TableCell><Badge variant="outline" className={`capitalize ${statusStyles[o.status] || ""}`}>{o.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/purchase/orders/${o.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      {o.status === "open" && <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Receive Goods" onClick={() => handleReceive(o.id)}><CheckCircle className="h-3.5 w-3.5" /></Button>}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
    </div>
  );
}
