import { useState } from "react";
import { Link } from "wouter";
import { useListCreditNotes, useDeleteCreditNote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

export default function CreditNotesList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Credit Notes</h1>
          <p className="text-sm text-muted-foreground">Sale returns — stock added back to inventory</p>
        </div>
        <Link href="/accounts/credit-notes/new">
          <Button><Plus className="h-4 w-4 mr-2" />New Credit Note</Button>
        </Link>
      </div>
      <Card>
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
              ) : (notes as any[]).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No credit notes</TableCell></TableRow>
              ) : (notes as any[]).map((n: any) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-sm">{n.noteNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(n.date)}</TableCell>
                  <TableCell>{n.partyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{n.reason}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{formatCurrency(n.amount)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(n.id)}>
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
