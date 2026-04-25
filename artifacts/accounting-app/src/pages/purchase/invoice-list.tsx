import { useState } from "react";
import { Link } from "wouter";
import { useListPurchaseInvoices, useDeletePurchaseInvoice, getListPurchaseInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Eye, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

export default function PurchaseInvoiceList() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: invoices = [], isLoading } = useListPurchaseInvoices({ search: search || undefined });
  const deleteMutation = useDeletePurchaseInvoice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
    setDeleteId(null);
    toast({ title: "Invoice deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Purchase Invoices</h1>
        <Link href="/purchase/invoices/new"><Button><Plus className="h-4 w-4 mr-2" />New Invoice</Button></Link>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by supplier..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Supplier Inv#</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : (invoices as any[]).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No purchase invoices</TableCell></TableRow>
              ) : (invoices as any[]).map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-medium">{inv.partyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.supplierInvoiceNumber || "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.grandTotal)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(inv.balanceDue)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
