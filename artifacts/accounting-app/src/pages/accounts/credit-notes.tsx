import { useState } from "react";
import { useListCreditNotes, useDeleteCreditNote, useListDebitNotes, useDeleteDebitNote } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, today } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateCreditNote } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListParties } from "@workspace/api-client-react";

export default function CreditNotesList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: today(), partyId: "", partyName: "", reason: "", amount: "" });
  const { data: notes = [], isLoading } = useListCreditNotes({});
  const { data: parties = [] } = useListParties();
  const createMutation = useCreateCreditNote();
  const deleteMutation = useDeleteCreditNote();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const party = (parties as any[]).find((p: any) => p.id === Number(form.partyId));
    await createMutation.mutateAsync({ data: { date: form.date, partyId: Number(form.partyId), partyName: party?.name || form.partyName, reason: form.reason, amount: Number(form.amount) } as any });
    queryClient.invalidateQueries();
    setOpen(false);
    toast({ title: "Credit note created" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries();
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Credit Notes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Credit Note</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Credit Note</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Amount</Label><Input type="number" required value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
              </div>
              <div className="space-y-1"><Label>Party</Label><Select value={form.partyId} onValueChange={v => setForm(p => ({ ...p, partyId: v }))}><SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger><SelectContent>{(parties as any[]).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Reason *</Label><Input required value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Reason for credit note" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create Credit Note</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Note#</TableHead><TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : (notes as any[]).length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No credit notes</TableCell></TableRow>
                  : (notes as any[]).map((n: any) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono text-sm">{n.noteNumber}</TableCell>
                      <TableCell className="text-sm">{formatDate(n.date)}</TableCell>
                      <TableCell>{n.partyName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{n.reason}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(n.amount)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(n.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
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
