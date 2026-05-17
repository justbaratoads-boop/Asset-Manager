import { useState, useEffect } from "react";
import { useListLedgers, useListParties, useCreateLedger, useUpdateLedger, useDeleteLedger, getListLedgersQueryKey, getListPartiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Plus, Pencil, Trash2, Search, BookOpen, Users, Eye } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";

const PAGE_SIZE = 25;
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
const gstBadge: Record<string, string> = {
  registered:   "bg-green-100 text-green-700 border-green-300",
  unregistered: "bg-gray-100 text-gray-600 border-gray-300",
  composition:  "bg-blue-100 text-blue-700 border-blue-300",
};

// Unified result type across both sources
type UnifiedAccount =
  | { kind: "ledger"; id: number; name: string; group: string; nature: string; openingBalance: number; raw: any }
  | { kind: "party";  id: number; name: string; group: string; gstType: string; openingBalance: number; balanceType: string; raw: any };

export default function LedgerAccounts() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "ledger" | "party">("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState(BLANK);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);

  const { data: ledgers = [], isLoading: ledgersLoading } = useListLedgers({});
  const { data: parties = [], isLoading: partiesLoading } = useListParties();
  const { data: accountGroups = [] } = useAccountGroups();
  const deleteMutation = useDeleteLedger();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isLoading = ledgersLoading || partiesLoading;

  useEffect(() => { setPage(1); }, [search, groupFilter, sourceFilter]);

  // Build unified list
  const unified: UnifiedAccount[] = [
    ...(ledgers as any[]).map((l: any): UnifiedAccount => ({
      kind: "ledger", id: l.id, name: l.name, group: l.group, nature: l.nature,
      openingBalance: Number(l.openingBalance), raw: l,
    })),
    ...(parties as any[]).map((p: any): UnifiedAccount => ({
      kind: "party", id: p.id, name: p.name, group: p.accountGroup || "Parties",
      gstType: p.gstType, openingBalance: Number(p.openingBalance), balanceType: p.balanceType, raw: p,
    })),
  ];

  const q = search.toLowerCase();
  const filtered = unified.filter(u => {
    if (sourceFilter !== "all" && u.kind !== sourceFilter) return false;
    if (groupFilter !== "all" && u.group !== groupFilter) return false;
    if (q) {
      return u.name.toLowerCase().includes(q) || u.group.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // All groups: from account groups + party account groups
  const allGroups = Array.from(new Set([
    ...(accountGroups as any[]).map((g: any) => g.name),
    ...(parties as any[]).map((p: any) => p.accountGroup).filter(Boolean),
  ])).sort();

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
      toast({ title: "Error", description: err?.data?.error || "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      queryClient.invalidateQueries({ queryKey: getListLedgersQueryKey() });
      toast({ title: "Account deleted" });
    } catch (err: any) {
      toast({ title: "Cannot delete", description: err?.data?.error || "Failed to delete", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Ledger Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Accounts from{" "}
            <Link href="/accounts/chart-of-accounts" className="text-primary underline underline-offset-2">Chart of Accounts</Link>
            {" "}and Ledger — {filtered.length} total
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Account</Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Search + filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search ledgers and parties..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus={false}
              />
            </div>
            <Select value={sourceFilter} onValueChange={v => setSourceFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="ledger">Ledger Accounts</SelectItem>
                <SelectItem value="party">Parties / Ledger</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {allGroups.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No accounts found</div>
            ) : paginated.map(u => (
              <div key={`${u.kind}-${u.id}`} className="border rounded-lg p-3 bg-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={u.kind === "ledger" ? `/accounts/ledgers/${u.id}` : `/accounts/parties/${u.id}?from=ledgers`}
                        className="font-semibold truncate hover:text-primary hover:underline"
                      >
                        {u.name}
                      </Link>
                      {u.kind === "ledger" ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-sky-200 text-sky-700 bg-sky-50">
                          <BookOpen className="h-2.5 w-2.5" />Ledger
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-violet-200 text-violet-700 bg-violet-50">
                          <Users className="h-2.5 w-2.5" />Party
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.group}</p>
                  </div>
                  <p className="font-bold text-sm shrink-0">{formatCurrency(u.openingBalance)}</p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  {u.kind === "ledger" ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${natureColors[u.nature]}`}>
                      {u.nature === "dr" ? "Dr" : "Cr"}
                    </span>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${gstBadge[u.gstType] || ""}`}>
                      {u.gstType}
                    </span>
                  )}
                  {u.kind === "ledger" && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(u.raw)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                  {u.kind === "party" && (
                    <Link href={`/accounts/parties/${u.id}/edit`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"><Pencil className="h-3 w-3" />Edit</Button>
                    </Link>
                  )}
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
                  <TableHead>Source</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Type / GST</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No accounts found</TableCell></TableRow>
                ) : paginated.map(u => (
                  <TableRow key={`${u.kind}-${u.id}`} className="cursor-pointer hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <Link
                        href={u.kind === "ledger" ? `/accounts/ledgers/${u.id}` : `/accounts/parties/${u.id}?from=ledgers`}
                        className="hover:underline hover:text-primary"
                      >
                        {u.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {u.kind === "ledger" ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-sky-200 text-sky-700 bg-sky-50">
                          <BookOpen className="h-2.5 w-2.5" />Ledger
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-violet-200 text-violet-700 bg-violet-50">
                          <Users className="h-2.5 w-2.5" />Party
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.group}</TableCell>
                    <TableCell>
                      {u.kind === "ledger" ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${natureColors[u.nature]}`}>
                          {u.nature === "dr" ? "Dr (Debit)" : "Cr (Credit)"}
                        </span>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${gstBadge[u.gstType] || ""}`}>
                          {u.gstType}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(u.openingBalance)}
                      {u.kind === "party" && (
                        <span className="text-muted-foreground text-xs ml-1 uppercase">{u.balanceType}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {u.kind === "ledger" ? (
                          <>
                            <Link href={`/accounts/ledgers/${u.id}`}>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="View Statement"><Eye className="h-3.5 w-3.5" /></Button>
                            </Link>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(u.raw)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <>
                            <Link href={`/accounts/parties/${u.id}?from=ledgers`}>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" title="View Ledger"><Eye className="h-3.5 w-3.5" /></Button>
                            </Link>
                            <Link href={`/accounts/parties/${u.id}/edit`}>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit Party"><Pencil className="h-3.5 w-3.5" /></Button>
                            </Link>
                          </>
                        )}
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

      {/* Add/Edit Ledger Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Ledger Account" : "New Ledger Account"}</DialogTitle>
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
                setForm(p => ({ ...p, group: v, nature: grp ? (grp.nature === "Asset" || grp.nature === "Expense" ? "dr" : "cr") : p.nature }));
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
