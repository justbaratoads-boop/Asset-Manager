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
import { Plus, Search, Trash2, CheckCircle } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Purchase Orders</h1>
        <Link href="/purchase/orders/new"><Button><Plus className="h-4 w-4 mr-2" />New PO</Button></Link>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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
