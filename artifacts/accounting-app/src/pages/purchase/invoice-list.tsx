import { useState } from "react";
import { Link } from "wouter";
import { useListPurchaseInvoices, useDeletePurchaseInvoice, getListPurchaseInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
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

  const list = invoices as any[];

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

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No purchase invoices</div>
        ) : list.map((inv: any) => (
          <Card key={inv.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{inv.partyName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber} · {formatDate(inv.date)}</p>
                  {inv.supplierInvoiceNumber && (
                    <p className="text-xs text-muted-foreground">Supplier Inv: {inv.supplierInvoiceNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-base">{formatCurrency(inv.grandTotal)}</p>
                  {Number(inv.balanceDue) > 0 && (
                    <p className="text-xs text-red-600">Due: {formatCurrency(inv.balanceDue)}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Link href={`/purchase/invoices/${inv.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(inv.id)}>
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
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No purchase invoices</TableCell></TableRow>
              ) : list.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-medium">{inv.partyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.supplierInvoiceNumber || "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.grandTotal)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(inv.balanceDue)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/purchase/invoices/${inv.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(inv.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
