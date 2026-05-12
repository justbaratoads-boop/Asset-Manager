import { useState, useEffect } from "react";
import { useListLedgers, useCreateLedger, useUpdateLedger, useDeleteLedger, getListLedgersQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";

const PAGE_SIZE = 20;
const BLANK = { name: "", group: "", nature: "dr", openingBalance: "" };

function useAccountGroups() {
  return useQuery({
    queryKey: ["account-groups"],
    queryFn: () => customFetch<any[]>("/api/account-groups"),
  });
}

const natureColors: Record<string, string> = {
  dr: "bg-sky-50 text-sky-700 border-sky-200",
  cr: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function LedgerAccounts() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState(BLANK);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);

  const { data: ledgers = [], isLoading } = useListLedgers({});
  const { data: accountGroups = [] } = useAccountGroups();
  const deleteMutation = useDeleteLedger();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setPage(1); }, [search, groupFilter]);

  const filtered = (ledgers as any[]).filter((l: any) =>
    (groupFilter === "all" || l.group === groupFilter) &&
    (!search || l.name.toLowerCase().includes(search.toLowerCase()))
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openNew = () => {
    setEditItem(null);
    setForm({ ...BLANK, group: (accountGroups as any[])[0]?.name || "" });
    setDialogOpen(true);
  };

  const openEdit = (l: any) => {
    setEditItem(l);
    setForm({ name: l.name, group: l.group, nature: l.nature, openingBalance: String(l.openingBalance) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!form.group) { toast({ title: "Account group is required", variant: "destructive" }); return; }
    setIsSaving(true);
    try {
      if (editItem) {
        await customFetch(`/api/ledgers/${editItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, openingBalance: Number(form.openingBalance) || 0 }),
        });
        toast({ title: "Account updated" });
      } else {
        await customFetch("/api/ledgers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, openingBalance: Number(form.openingBalance) || 0 }),
        });
        toast({ title: "Account created" });
      }
      queryClient.invalidateQueries({ queryKey: getListLedgersQueryKey() });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListLedgersQueryKey() });
    setDeleteId(null);
    toast({ title: "Account deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Ledger Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Individual accounts under your{" "}
            <Link href="/accounts/chart-of-accounts" className="text-primary underline underline-offset-2">Chart of Accounts</Link>
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Account</Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {(accountGroups as any[]).map((g: any) => (
                  <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No accounts found</div>
            ) : paginated.map((l: any) => (
              <div key={l.id} className="border rounded-lg p-3 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{l.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{l.group}</p>
                  </div>
                  <p className="font-bold text-sm shrink-0">{formatCurrency(l.openingBalance)}</p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${natureColors[l.nature]}`}>
                    {l.nature === "dr" ? "Dr" : "Cr"}
                  </span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="md:hidden">
            <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Nature</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No accounts found</TableCell></TableRow>
                ) : paginated.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-muted-foreground">{l.group}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${natureColors[l.nature]}`}>
                        {l.nature === "dr" ? "Dr (Debit)" : "Cr (Credit)"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(l.openingBalance)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(l)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(l.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Account" : "New Ledger Account"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label>Account Name *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. HDFC Bank Account" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Account Group *</Label>
              <Select value={form.group} onValueChange={v => {
                const grp = (accountGroups as any[]).find((g: any) => g.name === v);
                setForm(p => ({ ...p, group: v, nature: grp?.nature || p.nature }));
              }}>
                <SelectTrigger className={!form.group ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select group..." />
                </SelectTrigger>
                <SelectContent>
                  {(accountGroups as any[]).map((g: any) => (
                    <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nature</Label>
              <Select value={form.nature} onValueChange={v => setForm(p => ({ ...p, nature: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dr">Debit (Dr)</SelectItem>
                  <SelectItem value="cr">Credit (Cr)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Auto-set from the group you choose</p>
            </div>
            <div className="space-y-1">
              <Label>Opening Balance</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input className="pl-7" type="number" value={form.openingBalance} onChange={e => setForm(p => ({ ...p, openingBalance: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? "Saving..." : editItem ? "Update" : "Create Account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={o => !o && setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
