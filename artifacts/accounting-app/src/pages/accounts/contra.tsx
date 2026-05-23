import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, Eye, ArrowRight, ArrowLeftRight } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

function isEdited(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
}

function useContraList() {
  return useQuery<any[]>({
    queryKey: ["contra-vouchers"],
    queryFn: () => customFetch("/api/journals?voucherType=contra"),
  });
}

export default function ContraList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useContraList();
  const list = entries as any[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteId) return;
    await customFetch(`/api/journals/${deleteId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["contra-vouchers"] });
    setDeleteId(null);
    toast({ title: "Contra voucher deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Contra Vouchers</h1>
          <p className="text-sm text-muted-foreground">{list.length} voucher{list.length !== 1 ? "s" : ""} · Cash ↔ Bank transfers</p>
        </div>
        <Link href="/accounts/contra/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Contra</Button>
        </Link>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 space-y-1">
            <ArrowLeftRight className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p>No contra vouchers yet</p>
            <p className="text-xs">Use contra entries to transfer funds between Cash and Bank accounts</p>
          </div>
        ) : paginated.map((j: any) => (
          <Card key={j.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground font-mono">{j.voucherNumber} · {formatDate(j.date)}</p>
                  <p className="font-medium text-sm mt-0.5 truncate">{j.narration}</p>
                  {isEdited(j.createdAt, j.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 mt-1">Edited</Badge>}
                </div>
                <p className="font-bold text-base text-primary shrink-0">{formatCurrency(j.totalDebit)}</p>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewId(j.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />View
                </Button>
                <Link href={`/accounts/contra/${j.id}/edit`} className="flex-1">
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
          {isLoading ? (
            <div className="text-center text-muted-foreground py-10">Loading...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-14 space-y-2">
              <ArrowLeftRight className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">No contra vouchers yet</p>
              <p className="text-sm text-muted-foreground">Use contra entries to transfer funds between Cash and Bank accounts</p>
              <Link href="/accounts/contra/new">
                <Button size="sm" className="mt-2"><Plus className="h-4 w-4 mr-1" />New Contra</Button>
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((j: any) => (
                    <TableRow key={j.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewId(j.id)}>
                      <TableCell className="font-mono text-sm font-medium">
                        {j.voucherNumber}
                        {isEdited(j.createdAt, j.updatedAt) && (
                          <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 ml-1">Edited</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(j.date)}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{j.narration}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatCurrency(j.totalDebit)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(j.id)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Link href={`/accounts/contra/${j.id}/edit`}>
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
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={false} />

      <ContraViewSheet id={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}

function ContraViewSheet({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["journal", id],
    queryFn: () => customFetch(`/api/journals/${id}`),
    enabled: !!id,
  });
  const entry = data as any;
  const lines: any[] = entry?.lines || [];
  const drLine = lines.find((l: any) => l.type === "dr");
  const crLine = lines.find((l: any) => l.type === "cr");
  const amount = drLine ? Number(drLine.amount) : 0;

  return (
    <Sheet open={!!id} onOpenChange={open => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Contra Voucher
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading...</div>
        ) : !entry ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Entry not found</div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Header */}
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
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Amount</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(amount)}</span>
              </div>
              {entry.narration && (
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Narration</p>
                  <p className="text-sm">{entry.narration}</p>
                </div>
              )}
            </div>

            {/* Transfer visual */}
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transfer Details</p>
              </div>
              <div className="p-4 flex items-center gap-3">
                <div className="flex-1 rounded-lg bg-rose-50 border border-rose-200 px-3 py-3 text-center">
                  <p className="text-xs text-rose-600 font-medium mb-0.5">From (Source)</p>
                  <p className="font-semibold text-sm text-rose-700">{crLine?.ledgerName || "—"}</p>
                  <p className="text-xs text-rose-500 mt-0.5">Credited</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 rounded-lg bg-sky-50 border border-sky-200 px-3 py-3 text-center">
                  <p className="text-xs text-sky-600 font-medium mb-0.5">To (Destination)</p>
                  <p className="font-semibold text-sm text-sky-700">{drLine?.ledgerName || "—"}</p>
                  <p className="text-xs text-sky-500 mt-0.5">Debited</p>
                </div>
              </div>
              <div className="border-t bg-primary/5 px-4 py-2 text-center">
                <p className="text-sm font-bold text-primary">{formatCurrency(amount)} transferred</p>
              </div>
            </div>

            {entry.createdAt && (
              <p className="text-xs text-muted-foreground text-right">
                Created {new Date(entry.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
              {id && (
                <Link href={`/accounts/contra/${id}/edit`} className="flex-1">
                  <Button className="w-full gap-2"><Pencil className="h-4 w-4" />Edit</Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
