import { useState } from "react";
import { useListLedgers, useCreateLedger, useDeleteLedger, getListLedgersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Plus, Trash2, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

export default function LedgersList() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", group: "assets", nature: "dr", openingBalance: "" });
  const { data: ledgers = [], isLoading } = useListLedgers({});
  const createMutation = useCreateLedger();
  const deleteMutation = useDeleteLedger();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = (ledgers as any[]).filter((l: any) => (groupFilter === "all" || l.group === groupFilter) && (!search || l.name.toLowerCase().includes(search.toLowerCase())));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ data: { ...form, openingBalance: Number(form.openingBalance) } as any });
    queryClient.invalidateQueries({ queryKey: getListLedgersQueryKey() });
    setOpen(false);
    setForm({ name: "", group: "assets", nature: "dr", openingBalance: "" });
    toast({ title: "Ledger created" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListLedgersQueryKey() });
    setDeleteId(null);
  };

  const groupColors: Record<string, string> = { assets: "bg-blue-100 text-blue-700", liabilities: "bg-red-100 text-red-700", income: "bg-green-100 text-green-700", expense: "bg-orange-100 text-orange-700", capital: "bg-purple-100 text-purple-700" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ledger Master</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Ledger</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Ledger</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Name *</Label><Input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Group</Label><Select value={form.group} onValueChange={v => setForm(p => ({ ...p, group: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="assets">Assets</SelectItem><SelectItem value="liabilities">Liabilities</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem><SelectItem value="capital">Capital</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label>Nature</Label><Select value={form.nature} onValueChange={v => setForm(p => ({ ...p, nature: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dr">Debit (Dr)</SelectItem><SelectItem value="cr">Credit (Cr)</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-1"><Label>Opening Balance</Label><Input type="number" value={form.openingBalance} onChange={e => setForm(p => ({ ...p, openingBalance: e.target.value }))} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating..." : "Create Ledger"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <Select value={groupFilter} onValueChange={setGroupFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Groups</SelectItem><SelectItem value="assets">Assets</SelectItem><SelectItem value="liabilities">Liabilities</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem><SelectItem value="capital">Capital</SelectItem></SelectContent></Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Group</TableHead><TableHead>Nature</TableHead><TableHead className="text-right">Opening Balance</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : filtered.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell><Badge variant="outline" className={`capitalize ${groupColors[l.group] || ""}`}>{l.group}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="uppercase">{l.nature}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(l.openingBalance)}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
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
