import { useState } from "react";
import { Link } from "wouter";
import { useListPayments, useDeletePayment, useListLedgers, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

function isEdited(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
}

const PAGE_SIZE = 20;

export default function PaymentList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const { data: payments = [], isLoading } = useListPayments({});
  const { data: ledgers = [] } = useListLedgers({});
  const deleteMutation = useDeletePayment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const ledgerName = (id: number) => (ledgers as any[]).find((l: any) => l.id === id)?.name || "-";

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
    setDeleteId(null);
    toast({ title: "Payment deleted" });
  };

  const list = payments as any[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatLedgersSummary = (p: any) => {
    let allocs: any[] = [];
    if (p.ledgerAllocations) {
      try {
        allocs = typeof p.ledgerAllocations === "string" ? JSON.parse(p.ledgerAllocations) : p.ledgerAllocations;
      } catch {}
    }
    if (allocs && allocs.length > 1) {
      const first = ledgerName(Number(allocs[0].ledgerId));
      return `${first} + ${allocs.length - 1} more`;
    }
    if (allocs && allocs.length === 1) {
      return ledgerName(Number(allocs[0].ledgerId));
    }
    return ledgerName(p.ledgerId);
  };

  const getLedgerAllocations = (viewItem: any) => {
    if (!viewItem || !viewItem.ledgerAllocations) return [];
    try {
      const allocs = typeof viewItem.ledgerAllocations === "string" ? JSON.parse(viewItem.ledgerAllocations) : viewItem.ledgerAllocations;
      return Array.isArray(allocs) ? allocs : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Payment Vouchers</h1>
          <p className="text-sm text-muted-foreground">{list.length} payments</p>
        </div>
        <Link href="/accounts/payments/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Payment</Button></Link>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No payments found</div>
        ) : paginated.map((p: any) => (
          <Card key={p.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setViewItem(p)}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{p.partyName || "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.voucherNumber} · {formatDate(p.date)}</p>
                  <p className="text-xs text-muted-foreground">{formatLedgersSummary(p)}</p>
                  {p.narration && <p className="text-xs text-muted-foreground">{p.narration}</p>}
                  {isEdited(p.createdAt, p.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 mt-0.5">Edited</Badge>}
                </div>
                <p className="font-bold text-base text-red-600">{formatCurrency(p.amount)}</p>
              </div>
              <div className="flex gap-2 border-t pt-3" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewItem(p)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />View
                </Button>
                <Link href={`/accounts/payments/${p.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(p.id)}>
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
                <TableHead>Party</TableHead>
                <TableHead>Ledger</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No payments</TableCell></TableRow>
              ) : paginated.map((p: any) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewItem(p)}>
                  <TableCell className="font-mono text-sm">
                    {p.voucherNumber}
                    {isEdited(p.createdAt, p.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 ml-1">Edited</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(p.date)}</TableCell>
                  <TableCell>{p.partyName || "-"}</TableCell>
                  <TableCell className="text-sm">{formatLedgersSummary(p)}</TableCell>
                  <TableCell className="text-right font-medium text-red-600">{formatCurrency(p.amount)}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewItem(p)}><Eye className="h-3.5 w-3.5" /></Button>
                      <Link href={`/accounts/payments/${p.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewItem} onOpenChange={o => !o && setViewItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Voucher — {viewItem?.voucherNumber}</DialogTitle>
          </DialogHeader>
          {viewItem && (() => {
            const allocs = getLedgerAllocations(viewItem);
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Voucher No.</p>
                    <p className="font-mono font-medium">{viewItem.voucherNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDate(viewItem.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Party</p>
                    <p className="font-medium">{viewItem.partyName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="font-bold text-red-600 text-base">{formatCurrency(viewItem.amount)}</p>
                  </div>
                  {allocs.length > 0 ? (
                    <div className="col-span-2 space-y-1.5 border-t pt-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ledger Allocations</p>
                      <div className="rounded-md border bg-muted/30 p-2.5 space-y-1.5 divide-y divide-muted/50">
                        {allocs.map((a: any, idx: number) => (
                          <div key={idx} className={`flex justify-between items-center text-xs ${idx > 0 ? "pt-1.5" : ""}`}>
                            <span className="font-medium text-foreground">{ledgerName(Number(a.ledgerId))}</span>
                            <span className="font-semibold text-foreground">{formatCurrency(Number(a.amount))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground">Payment Ledger</p>
                      <p className="font-medium">{ledgerName(viewItem.ledgerId)}</p>
                    </div>
                  )}
                  {viewItem.narration && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Narration</p>
                      <p className="font-medium">{viewItem.narration}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Link href={`/accounts/payments/${viewItem.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setViewItem(null)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => { setDeleteId(viewItem.id); setViewItem(null); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
