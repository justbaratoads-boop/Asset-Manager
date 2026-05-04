import { useState } from "react";
import { Link } from "wouter";
import { useListPurchaseOrders, useDeletePurchaseOrder, useReceivePurchaseOrder, getListPurchaseOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Pencil, Trash2, CheckCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

export default function PurchaseOrderList() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: orders = [], isLoading } = useListPurchaseOrders({});
  const deleteMutation = useDeletePurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const filtered = (orders as any[]).filter((o: any) => !search || o.partyName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} orders</p>
        </div>
        <Link href="/purchase/orders/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New PO</Button></Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by supplier..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No purchase orders</div>
        ) : filtered.map((o: any) => (
          <Card key={o.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{o.partyName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{o.poNumber} · {formatDate(o.date)}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-base">{formatCurrency(o.grandTotal)}</p>
                  <Badge variant="outline" className={`capitalize text-xs ${o.status === "open" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{o.status}</Badge>
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
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No purchase orders</TableCell></TableRow>
              ) : filtered.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.poNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(o.date)}</TableCell>
                  <TableCell className="font-medium">{o.partyName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(o.grandTotal)}</TableCell>
                  <TableCell><Badge variant="outline" className={`capitalize ${o.status === "open" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{o.status}</Badge></TableCell>
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
        </CardContent>
      </Card>
      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
