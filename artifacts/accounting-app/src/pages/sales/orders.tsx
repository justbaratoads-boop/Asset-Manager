import { useState } from "react";
import { Link } from "wouter";
import { useListOrders, useDeleteOrder, useConvertOrderToInvoice, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Eye, Trash2, FileText } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  dispatched: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function OrderList() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: orders = [], isLoading } = useListOrders({ search: search || undefined });
  const deleteMutation = useDeleteOrder();
  const convertMutation = useConvertOrderToInvoice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    setDeleteId(null);
  };

  const handleConvert = async (id: number) => {
    const result = await convertMutation.mutateAsync({ id });
    toast({ title: "Order converted to invoice", description: `Invoice #${(result as any).invoiceNumber} created` });
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Order Booking</h1>
        <Link href="/sales/orders/new"><Button><Plus className="h-4 w-4 mr-2" />New Order</Button></Link>
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
              ) : (orders as any[]).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No orders found</TableCell></TableRow>
              ) : (orders as any[]).map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">{order.orderNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(order.date)}</TableCell>
                  <TableCell className="font-medium">{order.partyName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(order.grandTotal)}</TableCell>
                  <TableCell><Badge variant="outline" className={`capitalize ${statusColors[order.status] || ""}`}>{order.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/sales/orders/${order.id}`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                      </Link>
                      {order.status === "pending" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600" title="Convert to Invoice" onClick={() => handleConvert(order.id)}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(order.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
