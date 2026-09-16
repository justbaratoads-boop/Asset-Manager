import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListCreditNotes, useDeleteCreditNote, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2, Eye, FileText, Printer } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

function isEdited(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
}

const PAGE_SIZE = 20;

function CreditNoteViewSheet({ id, onClose }: { id: number | null; onClose: () => void; }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastId, setLastId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) { setData(null); setLastId(null); return; }
    if (id === lastId) return;
    setLastId(id);
    setLoading(true);
    setData(null);
    customFetch<any>(`/api/credit-notes/${id}`)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id, lastId]);

  const items: any[] = data?.items || [];
  const otherChargesList: any[] = (() => {
    try { return JSON.parse(data?.otherCharges || "[]"); } catch { return []; }
  })();

  const taxable = items.reduce((s, i) => s + Number(i.taxableAmount || 0), 0);
  const cgst = items.reduce((s, i) => s + Number(i.cgst || 0), 0);
  const sgst = items.reduce((s, i) => s + Number(i.sgst || 0), 0);
  const igst = items.reduce((s, i) => s + Number(i.igst || 0), 0);

  return (
    <Sheet open={!!id} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              <span>Credit Note Details</span>
            </div>
            {id && (
              <div className="flex items-center gap-1.5">
                <Link href={`/accounts/credit-notes/${id}`}>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                    <Printer className="h-3.5 w-3.5" /> Full Print
                  </Button>
                </Link>
                <Link href={`/accounts/credit-notes/${id}/edit`}>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </Link>
              </div>
            )}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading...</div>
        ) : !data ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Not found</div>
        ) : (
          <div className="mt-6 space-y-5">
            {/* Header info */}
            <div className="rounded-lg border bg-muted/30 divide-y">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Note Number</span>
                <span className="font-mono font-semibold text-sm">{data.noteNumber}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Date</span>
                <span className="text-sm font-medium">{formatDate(data.date)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Party / Customer</span>
                <span className="text-sm font-semibold">{data.partyName}</span>
              </div>
              {data.reason && (
                <div className="px-4 py-2.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
                  <p className="text-sm">{data.reason}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Items Returned</p>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Item</th>
                      <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="text-right px-2 py-2 text-xs font-semibold text-muted-foreground">Rate</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{item.itemName}</p>
                          {item.batchName && <p className="text-xs text-blue-600 font-mono">Batch: {item.batchName}</p>}
                          {Number(item.gstPct) > 0 && <p className="text-xs text-muted-foreground">GST {item.gstPct}%</p>}
                        </td>
                        <td className="px-2 py-2.5 text-right text-muted-foreground whitespace-nowrap">{Number(item.quantity)} {item.unit}</td>
                        <td className="px-2 py-2.5 text-right whitespace-nowrap">{formatCurrency(Number(item.rate))}</td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary / Totals */}
            <div className="rounded-lg border bg-muted/30 divide-y text-sm">
              <div className="flex justify-between px-4 py-2">
                <span className="text-muted-foreground">Taxable Amount</span>
                <span>{formatCurrency(taxable)}</span>
              </div>
              {cgst > 0 && (
                <>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">CGST</span>
                    <span>+ {formatCurrency(cgst)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-muted-foreground">SGST</span>
                    <span>+ {formatCurrency(sgst)}</span>
                  </div>
                </>
              )}
              {igst > 0 && (
                <div className="flex justify-between px-4 py-2">
                  <span className="text-muted-foreground">IGST</span>
                  <span>+ {formatCurrency(igst)}</span>
                </div>
              )}
              {otherChargesList.map((c: any, i: number) => (
                <div key={i} className="flex justify-between px-4 py-2">
                  <span className="text-muted-foreground">{c.ledgerName || c.name || "Other Charges"}</span>
                  <span>{c.type === "deduct" ? "- " : "+ "}{formatCurrency(Number(c.amount))}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 font-bold text-base text-green-700">
                <span>Credit Amount</span>
                <span>{formatCurrency(Number(data.amount))}</span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function CreditNotesList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
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
          <Card key={n.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setViewId(n.id)}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base">{n.partyName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{n.noteNumber} · {formatDate(n.date)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.reason}</p>
                  {isEdited(n.createdAt, n.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 mt-0.5">Edited</Badge>}
                </div>
                <p className="font-bold text-base text-green-600 shrink-0">{formatCurrency(n.amount)}</p>
              </div>
              <div className="flex gap-2 border-t pt-3" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setViewId(n.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />View
                </Button>
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
                <TableRow key={n.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setViewId(n.id)}>
                  <TableCell className="font-mono text-sm">
                    {n.noteNumber}
                    {isEdited(n.createdAt, n.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200 ml-1">Edited</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(n.date)}</TableCell>
                  <TableCell>{n.partyName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{n.reason}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{formatCurrency(n.amount)}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="View" onClick={() => setViewId(n.id)}><Eye className="h-3.5 w-3.5" /></Button>
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
      <CreditNoteViewSheet id={viewId} onClose={() => setViewId(null)} />
    </div>
  );
}
