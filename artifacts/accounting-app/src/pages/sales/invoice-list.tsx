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
import { Plus, Search, Eye, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

const statusStyles: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={`capitalize text-xs ${statusStyles[status] || ""}`}>{status}</Badge>;
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

  const list = invoices as any[];

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by party name..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No invoices found</div>
        ) : list.map((inv: any) => (
          <Card key={inv.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{inv.partyName || "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber} · {formatDate(inv.date)}</p>
                </div>
                <StatusBadge status={inv.status} />
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
                <Link href={`/sales/invoices/${inv.id}`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
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
              ) : list.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-medium">{inv.partyName}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(inv.amountPaid)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(inv.balanceDue)}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/sales/invoices/${inv.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Link href={`/sales/invoices/${inv.id}`}><Button size="icon" variant="ghost" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button></Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(inv.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} title="Delete Invoice?" description="This will permanently delete the invoice." onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
