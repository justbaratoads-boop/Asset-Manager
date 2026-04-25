import { useState } from "react";
import { useListSaleInvoices, useDeleteSaleInvoice, getListSaleInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Printer, Eye, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    confirmed: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    partial: "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return <Badge variant="outline" className={`capitalize ${map[status] || ""}`}>{status}</Badge>;
}

export default function SaleInvoiceList() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: invoices = [], isLoading } = useListSaleInvoices({ search: search || undefined });
  const deleteMutation = useDeleteSaleInvoice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListSaleInvoicesQueryKey() });
    toast({ title: "Invoice deleted" });
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Sale Invoices</h1>
          <p className="text-sm text-muted-foreground">{invoices.length} invoices</p>
        </div>
        <Link href="/sales/invoices/new">
          <Button><Plus className="h-4 w-4 mr-2" />New Invoice</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by party name..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
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
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No invoices found</TableCell></TableRow>
              ) : invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-medium">{inv.partyName}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(inv.amountPaid)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(inv.balanceDue)}</TableCell>
                  <TableCell>{statusBadge(inv.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/sales/invoices/${inv.id}`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(inv.id)}>
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Invoice?"
        description="This will permanently delete the invoice. This action cannot be undone."
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
