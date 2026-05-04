import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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

function useAccountGroups() {
  return useQuery({
    queryKey: ["account-groups"],
    queryFn: () => customFetch<any[]>("/api/account-groups"),
  });
}

const BLANK = { name: "", nature: "Asset", statement: "Balance Sheet", parentGroup: "assets" };

export default function ChartOfAccounts() {
  const { data: groups = [], isLoading } = useAccountGroups();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filterParent, setFilterParent] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState(BLANK);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = (groups as any[]).filter(g =>
    (filterParent === "all" || g.parentGroup === filterParent) &&
    (!search || g.name.toLowerCase().includes(search.toLowerCase()))
  );

  const grouped = PARENT_GROUPS.map(pg => ({
    ...pg,
    items: filtered.filter(g => g.parentGroup === pg.value),
  })).filter(pg => pg.items.length > 0);

  const openNew = () => {
    setEditItem(null);
    setForm(BLANK);
    setDialogOpen(true);
  };

  const openEdit = (g: any) => {
    setEditItem(g);
    setForm({ name: g.name, nature: g.nature, statement: g.statement, parentGroup: g.parentGroup });
    setDialogOpen(true);
  };

  const handleNatureChange = (nature: string) => {
    const opt = NATURE_OPTIONS.find(o => o.value === nature);
    const pg = PARENT_GROUPS.find(p => p.nature === nature);
    setForm(prev => ({
      ...prev,
      nature,
      statement: opt?.statement ?? prev.statement,
      parentGroup: pg?.value ?? prev.parentGroup,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
    setIsSaving(true);
    try {
      if (editItem) {
        await customFetch(`/api/account-groups/${editItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Account group updated" });
      } else {
        await customFetch("/api/account-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast({ title: "Account group added" });
      }
      queryClient.invalidateQueries({ queryKey: ["account-groups"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await customFetch(`/api/account-groups/${deleteId}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["account-groups"] });
      toast({ title: "Account group deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Cannot delete", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">Account groups used to classify ledger entries</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Group</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterParent} onValueChange={setFilterParent}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {PARENT_GROUPS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-4">
          {filterParent === "all" ? (
            grouped.map(pg => (
              <Card key={pg.value}>
                <div className={`px-4 py-2 rounded-t-lg border-b font-semibold text-sm flex items-center gap-2 ${parentColors[pg.value]}`}>
                  {pg.label}
                  <span className="font-normal opacity-60 text-xs">({pg.items.length} groups)</span>
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded border ${statementColors[pg.items[0]?.statement] ?? ""}`}>
                    {pg.items[0]?.statement}
                  </span>
                </div>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group Name</TableHead>
                        <TableHead>Nature</TableHead>
                        <TableHead>Statement</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pg.items.map((g: any) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-2">
                              {g.name}
                              {g.isSystem === "true" && <Lock className="h-3 w-3 text-muted-foreground" title="System group" />}
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
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                              {g.isSystem !== "true" && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group Name</TableHead>
                      <TableHead>Nature</TableHead>
                      <TableHead>Statement</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((g: any) => (
                      <TableRow key={g.id}>
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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                            {g.isSystem !== "true" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No groups found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Account Group" : "New Account Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label>Group Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Advance to Employees"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Nature</Label>
              <Select value={form.nature} onValueChange={handleNatureChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NATURE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Financial Statement</Label>
              <div className={`text-sm px-3 py-2 rounded-md border font-medium ${statementColors[form.statement] ?? "bg-muted"}`}>
                {form.statement}
              </div>
              <p className="text-xs text-muted-foreground">Auto-set based on Nature</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editItem ? "Update" : "Add Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={o => !o && setDeleteId(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Delete Account Group"
        description="Are you sure you want to delete this account group? This cannot be undone."
      />
    </div>
  );
}
