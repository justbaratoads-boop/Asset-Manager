import { useState } from "react";
import { Link } from "wouter";
import { useListJournals, useDeleteJournal, getListJournalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

export default function JournalList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: journals = [], isLoading } = useListJournals({});
  const deleteMutation = useDeleteJournal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListJournalsQueryKey() });
    setDeleteId(null);
    toast({ title: "Journal entry deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Journal Entries</h1>
        <Link href="/accounts/journal/new"><Button><Plus className="h-4 w-4 mr-2" />New Entry</Button></Link>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Voucher#</TableHead><TableHead>Date</TableHead><TableHead>Narration</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : (journals as any[]).length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No journal entries</TableCell></TableRow>
                  : (journals as any[]).map((j: any) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-sm">{j.voucherNumber}</TableCell>
                      <TableCell className="text-sm">{formatDate(j.date)}</TableCell>
                      <TableCell className="text-sm">{j.narration}</TableCell>
                      <TableCell className="text-right">{formatCurrency(j.totalDebit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(j.totalCredit)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(j.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
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
