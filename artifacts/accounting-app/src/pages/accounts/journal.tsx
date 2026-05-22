import { useState } from "react";
import { Link } from "wouter";
import { useListJournals, useDeleteJournal, useGetJournal, getListJournalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, Eye, CheckCircle2, AlertCircle, BookOpen } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

function isEdited(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
}

const PAGE_SIZE = 20;

export default function JournalList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
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
        <Link href="/accounts/journal/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Entry</Button>
        </Link>
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
                  {isEdited(j.createdAt, j.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 mt-1">Edited</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-sky-50 rounded p-2">
                  <p className="text-xs text-muted-foreground">Debit</p>
                  <p className="font-semibold text-sky-700">{formatCurrency(j.totalDebit)}</p>
                </div>
                <div className="bg-rose-50 rounded p-2">
                  <p className="text-xs text-muted-foreground">Credit</p>
                  <p className="font-semibold text-rose-700">{formatCurrency(j.totalCredit)}</p>
                </div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewId(j.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />View
                </Button>
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
                <TableHead className="text-right text-sky-700">Debit</TableHead>
                <TableHead className="text-right text-rose-700">Credit</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No journal entries</TableCell></TableRow>
              ) : paginated.map((j: any) => (
                <TableRow key={j.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewId(j.id)}>
                  <TableCell className="font-mono text-sm font-medium">
                    {j.voucherNumber}
                    {isEdited(j.createdAt, j.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 ml-1">Edited</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(j.date)}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{j.narration}</TableCell>
                  <TableCell className="text-right font-medium text-sky-700">{formatCurrency(j.totalDebit)}</TableCell>
                  <TableCell className="text-right font-medium text-rose-700">{formatCurrency(j.totalCredit)}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(j.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/accounts/journal/${j.id}/edit`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(j.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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

      {/* View detail sheet */}
      <JournalViewSheet
        id={viewId}
        onClose={() => setViewId(null)}
        onEdit={id => { setViewId(null); window.location.href = `/accounts/journal/${id}/edit`; }}
      />
    </div>
  );
}

function JournalViewSheet({ id, onClose, onEdit }: { id: number | null; onClose: () => void; onEdit: (id: number) => void }) {
  const { data, isLoading } = useGetJournal(id!, { query: { enabled: !!id } } as any);
  const entry = data as any;

  const lines: any[] = entry?.lines || [];
  const drLines = lines.filter(l => l.type === "dr");
  const crLines = lines.filter(l => l.type === "cr");
  const totalDr = drLines.reduce((s: number, l: any) => s + Number(l.amount), 0);
  const totalCr = crLines.reduce((s: number, l: any) => s + Number(l.amount), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  return (
    <Sheet open={!!id} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Journal Entry
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading...</div>
        ) : !entry ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Entry not found</div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Header details */}
            <div className="rounded-lg border bg-muted/30 divide-y">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Voucher No.</span>
                <span className="font-mono font-semibold text-sm">{entry.voucherNumber}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Date</span>
                <span className="font-medium text-sm">{formatDate(entry.date)}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
                {balanced ? (
                  <Badge className="gap-1 bg-green-100 text-green-700 border-green-300 hover:bg-green-100">
                    <CheckCircle2 className="h-3 w-3" />Balanced
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />Unbalanced
                  </Badge>
                )}
              </div>
              {entry.narration && (
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Narration</p>
                  <p className="text-sm">{entry.narration}</p>
                </div>
              )}
            </div>

            {/* Lines — classic T-format */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Journal Lines</p>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground w-1/2">Ledger Account</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-sky-700 w-1/4">Dr (₹)</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-rose-700 w-1/4">Cr (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {/* DR lines first */}
                    {drLines.map((l: any, i: number) => (
                      <tr key={`dr-${i}`} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 font-medium">
                          {l.ledgerName || <span className="text-muted-foreground italic">Ledger #{l.ledgerId}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-sky-700">{formatCurrency(Number(l.amount))}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                      </tr>
                    ))}
                    {/* CR lines */}
                    {crLines.map((l: any, i: number) => (
                      <tr key={`cr-${i}`} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 pl-8 font-medium">
                          {l.ledgerName || <span className="text-muted-foreground italic">Ledger #{l.ledgerId}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground">—</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-rose-700">{formatCurrency(Number(l.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">Total</td>
                      <td className="px-3 py-2 text-right text-sky-700">{formatCurrency(totalDr)}</td>
                      <td className="px-3 py-2 text-right text-rose-700">{formatCurrency(totalCr)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Difference callout when unbalanced */}
            {!balanced && totalDr > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Difference of {formatCurrency(Math.abs(totalDr - totalCr))} — entry is not balanced
              </div>
            )}

            {/* Created at */}
            {entry.createdAt && (
              <p className="text-xs text-muted-foreground text-right">
                Created {new Date(entry.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
              {id && (
                <Link href={`/accounts/journal/${id}/edit`} className="flex-1">
                  <Button className="w-full gap-2"><Pencil className="h-4 w-4" />Edit Entry</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
