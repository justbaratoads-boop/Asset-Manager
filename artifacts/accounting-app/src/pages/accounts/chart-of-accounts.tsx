import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Lock, ChevronDown, ChevronRight, Layers, Info } from "lucide-react";
import React from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { customFetch, useListLedgers, useDeleteLedger, getListLedgersQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";

const NATURE_OPTIONS = [
  { value: "Asset",     label: "Asset",     statement: "Balance Sheet" },
  { value: "Liability", label: "Liability", statement: "Balance Sheet" },
  { value: "Equity",    label: "Equity",    statement: "Balance Sheet" },
  { value: "Income",    label: "Income",    statement: "Profit & Loss" },
  { value: "Expense",   label: "Expense",   statement: "Profit & Loss" },
];

const PARENT_GROUPS = [
  { value: "assets",      label: "Assets",      nature: "Asset" },
  { value: "liabilities", label: "Liabilities", nature: "Liability" },
  { value: "equity",      label: "Equity",      nature: "Equity" },
  { value: "income",      label: "Income",      nature: "Income" },
  { value: "expenses",    label: "Expenses",    nature: "Expense" },
];

const natureColors: Record<string, string> = {
  Asset:     "bg-blue-50 text-blue-700 border-blue-200",
  Liability: "bg-red-50 text-red-700 border-red-200",
  Equity:    "bg-purple-50 text-purple-700 border-purple-200",
  Income:    "bg-green-50 text-green-700 border-green-200",
  Expense:   "bg-orange-50 text-orange-700 border-orange-200",
};

const statementColors: Record<string, string> = {
  "Balance Sheet": "bg-sky-50 text-sky-700 border-sky-200",
  "Profit & Loss": "bg-amber-50 text-amber-700 border-amber-200",
};

const parentColors: Record<string, string> = {
  assets:      "bg-blue-100 text-blue-800 border-blue-200",
  liabilities: "bg-red-100 text-red-800 border-red-200",
  equity:      "bg-purple-100 text-purple-800 border-purple-200",
  income:      "bg-green-100 text-green-800 border-green-200",
  expenses:    "bg-orange-100 text-orange-800 border-orange-200",
};

const ledgerNatureColors: Record<string, string> = {
  dr: "bg-sky-50 text-sky-700 border-sky-200",
  cr: "bg-rose-50 text-rose-700 border-rose-200",
};

function useAccountGroups() {
  return useQuery({
    queryKey: ["account-groups"],
    queryFn: () => customFetch<any[]>("/api/account-groups"),
  });
}

const BLANK_GROUP = { name: "", nature: "Asset", statement: "Balance Sheet", parentGroup: "assets" };

export default function ChartOfAccounts() {
  const { data: groups = [], isLoading: groupsLoading } = useAccountGroups();
  const { data: ledgers = [], isLoading: ledgersLoading } = useListLedgers({});
  const queryClient = useQueryClient();
  const deleteLedger = useDeleteLedger();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Group dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<any>(null);
  const [groupForm, setGroupForm] = useState(BLANK_GROUP);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Account (ledger) dialog
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [accountForm, setAccountForm] = useState(BLANK_ACCOUNT);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);

  const isLoading = groupsLoading || ledgersLoading;

  const filteredGroups = (groups as any[]).filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedByParent = PARENT_GROUPS.map(pg => ({
    ...pg,
    items: filteredGroups.filter(g => g.parentGroup === pg.value),
  })).filter(pg => pg.items.length > 0 || !search);

  const getLedgersForGroup = (groupName: string) =>
    (ledgers as any[]).filter((l: any) => l.group === groupName);

  const toggleExpand = (id: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // --- Group CRUD ---
  const openNewGroup = () => {
    setEditGroup(null);
    setGroupForm(BLANK_GROUP);
    setGroupDialogOpen(true);
  };

  const openEditGroup = (g: any) => {
    setEditGroup(g);
    setGroupForm({ name: g.name, nature: g.nature, statement: g.statement, parentGroup: g.parentGroup });
    setGroupDialogOpen(true);
  };

  const handleNatureChange = (nature: string) => {
    const opt = NATURE_OPTIONS.find(o => o.value === nature);
    const pg = PARENT_GROUPS.find(p => p.nature === nature);
    setGroupForm(prev => ({
      ...prev,
      nature,
      statement: opt?.statement ?? prev.statement,
      parentGroup: pg?.value ?? prev.parentGroup,
    }));
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setIsSavingGroup(true);
    try {
      if (editGroup) {
        await customFetch(`/api/account-groups/${editGroup.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(groupForm),
        });
        toast({ title: "Account group updated" });
      } else {
        await customFetch("/api/account-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(groupForm),
        });
        toast({ title: "Account group added" });
      }
      queryClient.invalidateQueries({ queryKey: ["account-groups"] });
      setGroupDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save", variant: "destructive" });
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    setIsDeletingGroup(true);
    try {
      await customFetch(`/api/account-groups/${deleteGroupId}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["account-groups"] });
      toast({ title: "Account group deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Cannot delete", variant: "destructive" });
    } finally {
      setIsDeletingGroup(false);
      setDeleteGroupId(null);
    }
  };

  // --- Account (Ledger) CRUD ---
  const openEditAccount = (l: any) => {
    setEditAccount(l);
    setAccountForm({ name: l.name, group: l.group, nature: l.nature, openingBalance: String(l.openingBalance) });
    setAccountDialogOpen(true);
  };

  const handleSaveAccount = async () => {
    if (!accountForm.name.trim()) { toast({ title: "Account name is required", variant: "destructive" }); return; }
    if (!accountForm.group) { toast({ title: "Account group is required", variant: "destructive" }); return; }
    setIsSavingAccount(true);
    try {
      if (editAccount) {
        await customFetch(`/api/ledgers/${editAccount.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...accountForm, openingBalance: Number(accountForm.openingBalance) || 0 }),
        });
        toast({ title: "Account updated" });
      } else {
        await customFetch("/api/ledgers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...accountForm, openingBalance: Number(accountForm.openingBalance) || 0 }),
        });
        toast({ title: "Account created" });
      }
      queryClient.invalidateQueries({ queryKey: getListLedgersQueryKey() });
      setAccountDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save", variant: "destructive" });
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return;
    await deleteLedger.mutateAsync({ id: deleteAccountId });
    queryClient.invalidateQueries({ queryKey: getListLedgersQueryKey() });
    setDeleteAccountId(null);
    toast({ title: "Account deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">Account groups and their ledger accounts</p>
        </div>
        <Button onClick={openNewGroup}><Plus className="h-4 w-4 mr-2" />New Group</Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-5">
          {groupedByParent.map(pg => (
            <Card key={pg.value} className="overflow-hidden">
              {/* Parent header */}
              <div className={`px-4 py-2.5 border-b font-semibold text-sm flex items-center gap-2 ${parentColors[pg.value]}`}>
                <span>{pg.label}</span>
                <span className="font-normal opacity-60 text-xs">({pg.items.length} groups)</span>
              </div>

              {pg.items.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No groups yet</div>
              ) : (
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Group Name</TableHead>
                        <TableHead className="w-28">Nature</TableHead>
                        <TableHead className="w-36">Statement</TableHead>
                        <TableHead className="w-28 text-center">Accounts</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pg.items.map((g: any) => {
                        const groupLedgers = getLedgersForGroup(g.name);
                        const isExpanded = expandedGroups.has(g.id);
                        return (
                          <React.Fragment key={g.id}>
                            {/* Group row */}
                            <TableRow
                              key={g.id}
                              className="cursor-pointer hover:bg-muted/50 group"
                              onClick={() => toggleExpand(g.id)}
                            >
                              <TableCell className="pr-0 pl-3">
                                {isExpanded
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              </TableCell>
                              <TableCell className="font-medium">
                                <span className="flex items-center gap-2">
                                  {g.name}
                                  {g.isSystem === "true" && <Lock className="h-3 w-3 text-muted-foreground" />}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${natureColors[g.nature] ?? ""}`}>
                                  {g.nature}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statementColors[g.statement] ?? ""}`}>
                                  {g.statement}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                                  <Layers className="h-3 w-3" />
                                  {groupLedgers.length}
                                </span>
                              </TableCell>
                              <TableCell onClick={e => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditGroup(g)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  {g.isSystem !== "true" && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteGroupId(g.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* Expanded: ledger accounts */}
                            {isExpanded && (
                              <TableRow key={`${g.id}-expanded`} className="bg-muted/20 hover:bg-muted/20">
                                <TableCell colSpan={6} className="p-0">
                                  <div className="border-t border-border/40">
                                    {groupLedgers.length === 0 ? (
                                      <div className="pl-12 pr-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                                        <Info className="h-3.5 w-3.5 shrink-0" />
                                        No accounts yet. Go to{" "}
                                        <Link href="/accounts/ledgers" className="text-primary underline underline-offset-2 font-medium">Ledger</Link>
                                        {" "}to add accounts and select this group.
                                      </div>
                                    ) : (
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-border/40 bg-muted/10">
                                            <th className="pl-12 pr-3 py-2 text-left text-xs font-medium text-muted-foreground w-[40%]">Account Name</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-24">Nature</th>
                                            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Opening Balance</th>
                                            <th className="px-3 py-2 w-20"></th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {groupLedgers.map((l: any) => (
                                            <tr key={l.id} className="border-b border-border/20 last:border-0 hover:bg-muted/30">
                                              <td className="pl-12 pr-3 py-2.5 font-medium">{l.name}</td>
                                              <td className="px-3 py-2.5">
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase ${ledgerNatureColors[l.nature] ?? ""}`}>
                                                  {l.nature === "dr" ? "Dr" : "Cr"}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2.5 text-right text-muted-foreground">{formatCurrency(l.openingBalance)}</td>
                                              <td className="px-3 py-2.5">
                                                <div className="flex justify-end gap-1">
                                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditAccount(l)}><Pencil className="h-3 w-3" /></Button>
                                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteAccountId(l.id)}><Trash2 className="h-3 w-3" /></Button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr>
                                            <td colSpan={4} className="pl-12 pr-3 py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
                                              <Info className="h-3 w-3 shrink-0" />
                                              To add accounts here, go to{" "}
                                              <Link href="/accounts/ledgers" className="text-primary underline underline-offset-2 font-medium">Ledger</Link>
                                              {" "}and select this group.
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}

          {groupedByParent.every(pg => pg.items.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">No groups found</div>
          )}
        </div>
      )}

      {/* Add/Edit Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editGroup ? "Edit Account Group" : "New Account Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label>Group Name *</Label>
              <Input
                value={groupForm.name}
                onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Advance to Employees"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Nature</Label>
              <Select value={groupForm.nature} onValueChange={handleNatureChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NATURE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Financial Statement</Label>
              <div className={`text-sm px-3 py-2 rounded-md border font-medium ${statementColors[groupForm.statement] ?? "bg-muted"}`}>
                {groupForm.statement}
              </div>
              <p className="text-xs text-muted-foreground">Auto-set based on Nature</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveGroup} disabled={isSavingGroup}>
              {isSavingGroup ? "Saving..." : editGroup ? "Update" : "Add Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label>Account Name *</Label>
              <Input
                value={accountForm.name}
                onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. HDFC Bank Account"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Account Group</Label>
              <Select value={accountForm.group} onValueChange={v => {
                const grp = (groups as any[]).find((g: any) => g.name === v);
                setAccountForm(p => ({ ...p, group: v, nature: grp ? (grp.nature === "Asset" || grp.nature === "Expense" ? "dr" : "cr") : p.nature }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select group..." /></SelectTrigger>
                <SelectContent>
                  {(groups as any[]).map((g: any) => (
                    <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nature</Label>
              <Select value={accountForm.nature} onValueChange={v => setAccountForm(p => ({ ...p, nature: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dr">Debit (Dr)</SelectItem>
                  <SelectItem value="cr">Credit (Cr)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Auto-set from the group's nature</p>
            </div>
            <div className="space-y-1">
              <Label>Opening Balance</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                <Input className="pl-7" type="number" value={accountForm.openingBalance} onChange={e => setAccountForm(p => ({ ...p, openingBalance: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAccount} disabled={isSavingAccount}>
              {isSavingAccount ? "Saving..." : editAccount ? "Update" : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete group */}
      <ConfirmDialog
        open={!!deleteGroupId}
        onOpenChange={o => !o && setDeleteGroupId(null)}
        onConfirm={handleDeleteGroup}
        loading={isDeletingGroup}
        title="Delete Account Group"
        description="Are you sure you want to delete this account group? This cannot be undone."
      />

      {/* Confirm delete account */}
      <ConfirmDialog
        open={!!deleteAccountId}
        onOpenChange={o => !o && setDeleteAccountId(null)}
        onConfirm={handleDeleteAccount}
        loading={deleteLedger.isPending}
        title="Delete Account"
        description="Are you sure you want to delete this account? This cannot be undone."
      />
    </div>
  );
}
