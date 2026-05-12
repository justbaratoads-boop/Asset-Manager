import { useState } from "react";
import { Link } from "wouter";
import { useListCreditNotes, useDeleteCreditNote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

export default function CreditNotesList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const { data: notes = [], isLoading } = useListCreditNotes({});
  const deleteMutation = useDeleteCreditNote();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries();
    setDeleteId(null);
    toast({ title: "Credit note deleted" });
  };

  const list = notes as any[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Credit Notes</h1>
          <p className="text-sm text-muted-foreground">Sale returns — stock added back to inventory</p>
        </div>
        <Link href="/accounts/credit-notes/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New</Button></Link>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No credit notes</div>
        ) : paginated.map((n: any) => (
          <Card key={n.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base">{n.partyName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{n.noteNumber} · {formatDate(n.date)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.reason}</p>
                </div>
                <p className="font-bold text-base text-green-600 shrink-0">{formatCurrency(n.amount)}</p>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Link href={`/accounts/credit-notes/${n.id}`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                </Link>
                <Link href={`/accounts/credit-notes/${n.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(n.id)}>
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
                <TableHead>Note#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No credit notes</TableCell></TableRow>
              ) : paginated.map((n: any) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-sm">{n.noteNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(n.date)}</TableCell>
                  <TableCell>{n.partyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{n.reason}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{formatCurrency(n.amount)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/accounts/credit-notes/${n.id}`}><Button size="icon" variant="ghost" className="h-7 w-7" title="View"><Eye className="h-3.5 w-3.5" /></Button></Link>
                      <Link href={`/accounts/credit-notes/${n.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(n.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
