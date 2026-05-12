import { useState } from "react";
import { Link } from "wouter";
import { useListJournals, useDeleteJournal, getListJournalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

export default function JournalList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
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

  const list = journals as any[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Journal Entries</h1>
          <p className="text-sm text-muted-foreground">{list.length} entries</p>
        </div>
        <Link href="/accounts/journal/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Entry</Button></Link>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No journal entries</div>
        ) : paginated.map((j: any) => (
          <Card key={j.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground font-mono">{j.voucherNumber} · {formatDate(j.date)}</p>
                  <p className="font-medium text-sm mt-0.5 truncate">{j.narration}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-blue-50 rounded p-2">
                  <p className="text-xs text-muted-foreground">Debit</p>
                  <p className="font-semibold text-blue-700">{formatCurrency(j.totalDebit)}</p>
                </div>
                <div className="bg-green-50 rounded p-2">
                  <p className="text-xs text-muted-foreground">Credit</p>
                  <p className="font-semibold text-green-700">{formatCurrency(j.totalCredit)}</p>
                </div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Link href={`/accounts/journal/${j.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(j.id)}>
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
                <TableHead>Voucher#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No journal entries</TableCell></TableRow>
              ) : paginated.map((j: any) => (
                <TableRow key={j.id}>
                  <TableCell className="font-mono text-sm">{j.voucherNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(j.date)}</TableCell>
                  <TableCell className="text-sm">{j.narration}</TableCell>
                  <TableCell className="text-right">{formatCurrency(j.totalDebit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(j.totalCredit)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/accounts/journal/${j.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(j.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
