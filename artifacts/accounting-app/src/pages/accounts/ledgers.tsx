import { useState, useEffect, useRef } from "react";
import { useListLedgers, useListParties, useCreateLedger, useUpdateLedger, useDeleteLedger, getListLedgersQueryKey, getListPartiesQueryKey, useGetCompanySettings } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency, INDIAN_STATES } from "@/lib/format";
import { Plus, Pencil, Trash2, Search, BookOpen, Users, Eye, Lock, Info } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { Link } from "wouter";

const PAGE_SIZE = 25;
const BLANK_LEDGER = { name: "", group: "", nature: "dr", openingBalance: "", bankName: "", bankBranch: "", accountNumber: "", ifscCode: "", upiId: "", isGstApplicable: false, gstRate: "", hsnSac: "" };
const BLANK_PARTY = {
  name: "", accountGroup: "Sundry Debtors",
  gstType: "unregistered",
  address: "", city: "", state: "", pincode: "",
  gstin: "", pan: "", phone: "", email: "",
  paymentTerms: "",
  openingBalance: "", balanceType: "dr",
  creditLimitEnabled: false, creditLimit: "",
};
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function useAccountGroups() {
  return useQuery({
    queryKey: ["account-groups"],
    queryFn: () => customFetch<any[]>("/api/account-groups").then(groups => 
      groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    ),
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

type UnifiedAccount =
  | { kind: "ledger"; id: number; name: string; group: string; nature: string; openingBalance: number; isSystem: boolean; raw: any }
  | { kind: "party";  id: number; name: string; group: string; gstType: string; openingBalance: number; balanceType: string; raw: any };

// Searchable account group combobox
function AccountGroupSelect({ value, onChange, groups, error }: {
  value: string; onChange: (v: string) => void; groups: any[]; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filtered = groups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className={`w-full flex items-center justify-between h-10 rounded-md border px-3 py-2 text-sm bg-background
          ${error ? "border-destructive" : "border-input"} ${!value ? "text-muted-foreground" : ""}`}
      >
        <span className="truncate">{value || "Select account group..."}</span>
        <Search className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                className="w-full h-8 pl-8 pr-3 text-sm rounded border border-input bg-background outline-none"
                placeholder="Search groups..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">No groups found</div>
            ) : filtered.map((g: any) => (
              <button
                key={g.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2
                  ${value === g.name ? "bg-accent font-medium" : ""}`}
                onClick={() => { onChange(g.name); setOpen(false); }}
              >
                <span className="flex-1 truncate">{g.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">({g.nature})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LedgerAccounts() {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "ledger" | "party">("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"ledger" | "party">("ledger");
  const [editItem, setEditItem] = useState<any>(null);

  // Ledger form state
  const [ledgerForm, setLedgerForm] = useState(BLANK_LEDGER);

  // Party form state
  const [partyForm, setPartyForm] = useState(BLANK_PARTY);
  const [partyErrors, setPartyErrors] = useState<Record<string, string>>({});

  const [isSaving, setIsSaving] = useState(false);
  const [ledgerNameError, setLedgerNameError] = useState("");
  const [page, setPage] = useState(1);

  const { data: ledgers = [], isLoading: ledgersLoading } = useListLedgers({});
  const { data: parties = [], isLoading: partiesLoading } = useListParties();
  const { data: accountGroups = [] } = useAccountGroups();
  const { data: companySettings } = useGetCompanySettings();
  const deleteMutation = useDeleteLedger();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isLoading = ledgersLoading || partiesLoading;
  const companyState = (companySettings as any)?.state || "";
  const isOutOfState = companyState && partyForm.state && companyState !== partyForm.state;
  const needsGstin = partyForm.gstType === "registered" || partyForm.gstType === "composition";

  useEffect(() => { setPage(1); }, [search, groupFilter, sourceFilter]);

  const unified: UnifiedAccount[] = [
    ...(ledgers as any[]).filter((l: any) => l.id < 1000000).map((l: any): UnifiedAccount => ({
      kind: "ledger", id: l.id, name: l.name, group: l.group, nature: l.nature,
      openingBalance: Number(l.openingBalance), isSystem: l.isSystem === "true", raw: l,
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
    if (q) return u.name.toLowerCase().includes(q) || u.group.toLowerCase().includes(q);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allGroups = Array.from(new Set([
    ...(accountGroups as any[]).map((g: any) => g.name),
    ...(parties as any[]).map((p: any) => p.accountGroup).filter(Boolean),
  ])).sort();

  const openNew = () => {
    setEditItem(null);
    setDialogType("ledger");
    setLedgerForm({ ...BLANK_LEDGER, group: (accountGroups as any[])[0]?.name || "" });
    setPartyForm(BLANK_PARTY);
    setPartyErrors({});
    setLedgerNameError("");
    setDialogOpen(true);
  };

  const openEditLedger = (l: any) => {
    setEditItem({ ...l, kind: "ledger" });
    setDialogType("ledger");
    setLedgerForm({
      name: l.name, group: l.group, nature: l.nature, openingBalance: String(l.openingBalance),
      bankName: l.bankName || "", bankBranch: l.bankBranch || "",
      accountNumber: l.accountNumber || "", ifscCode: l.ifscCode || "", upiId: l.upiId || "",
      isGstApplicable: l.isGstApplicable || false, gstRate: l.gstRate || "", hsnSac: l.hsnSac || "",
    });
    setLedgerNameError("");
    setDialogOpen(true);
  };

  const setParty = (k: string, v: string | boolean) => {
    setPartyForm(prev => ({ ...prev, [k]: v }));
    setPartyErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const validateParty = () => {
    const e: Record<string, string> = {};
    if (!partyForm.name.trim()) e.name = "Name is required";
    if (!partyForm.accountGroup) e.accountGroup = "Account group is required";
    const stateRequired = partyForm.accountGroup === "Sundry Debtors" || partyForm.accountGroup === "Sundry Creditors";
    if (stateRequired && !partyForm.state) e.state = "State is required";
    if (partyForm.phone && !/^\d{10}$/.test(partyForm.phone)) e.phone = "Phone must be exactly 10 digits";
    if (partyForm.gstType !== "unregistered") {
      if (!partyForm.gstin) e.gstin = "GSTIN is required";
      else if (!GSTIN_REGEX.test(partyForm.gstin.toUpperCase())) e.gstin = "Invalid GSTIN format";
    }
    return e;
  };

  const handleSave = async () => {
    if (dialogType === "ledger") {
      if (!ledgerForm.name.trim()) { setLedgerNameError("Name is required"); return; }
      const duplicate = ledgers.find((l: any) => l.name.trim().toLowerCase() === ledgerForm.name.trim().toLowerCase() && l.id !== editItem?.id);
      if (duplicate) { setLedgerNameError("A ledger with this name already exists"); return; }
      if (!ledgerForm.group) { toast({ title: "Account group is required", variant: "destructive" }); return; }
      setLedgerNameError("");
      setIsSaving(true);
      try {
        if (editItem) {
          await customFetch(`/api/ledgers/${editItem.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...ledgerForm, openingBalance: Number(ledgerForm.openingBalance) || 0 }),
          });
          toast({ title: "Account updated" });
        } else {
          await customFetch("/api/ledgers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...ledgerForm, openingBalance: Number(ledgerForm.openingBalance) || 0 }),
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
    } else {
      const errs = validateParty();
      if (Object.keys(errs).length > 0) { setPartyErrors(errs); return; }
      const duplicate = ledgers.find((l: any) => l.name.trim().toLowerCase() === partyForm.name.trim().toLowerCase() && l.id !== editItem?.id);
      if (duplicate) { setPartyErrors({ ...errs, name: "A ledger with this name already exists" }); return; }
      setIsSaving(true);
      try {
        const payload = {
          ...partyForm,
          gstin: partyForm.gstType !== "unregistered" ? partyForm.gstin.toUpperCase() : undefined,
          paymentTerms: partyForm.paymentTerms || undefined,
          openingBalance: Number(partyForm.openingBalance) || 0,
          creditLimitEnabled: partyForm.creditLimitEnabled,
          creditLimit: partyForm.creditLimitEnabled && partyForm.creditLimit ? Number(partyForm.creditLimit) : undefined,
        };
        await customFetch("/api/parties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Ledger created" });
        queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
        setDialogOpen(false);
      } catch (err: any) {
        toast({ title: "Error", description: err?.data?.error || "Failed to save", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
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
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="ledger">Ledger Accounts</SelectItem>
                <SelectItem value="party">Parties / Ledger</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All Groups" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {allGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
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
                    <div className="flex gap-1 items-center">
                      {u.isSystem && (
                        <span title="System ledger" className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
                          <Lock className="h-3 w-3" />System
                        </span>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditLedger(u.raw)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => !u.isSystem && setDeleteId(u.id)} disabled={u.isSystem}><Trash2 className="h-3.5 w-3.5" /></Button>
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
                            {u.isSystem && (
                              <span title="System ledger" className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium px-1.5">
                                <Lock className="h-3 w-3" />System
                              </span>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditLedger(u.raw)}><Pencil className="h-3.5 w-3.5" /></Button>
                            {!u.isSystem && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            )}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={dialogType === "party" && !editItem ? "max-w-2xl max-h-[90vh] overflow-y-auto" : ledgerForm.group === "Bank Accounts" ? "max-w-md max-h-[90vh] overflow-y-auto" : "max-w-sm"}>
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Ledger Account" : "New Account"}</DialogTitle>
          </DialogHeader>

          {/* Type toggle — only for new accounts */}
          {!editItem && (
            <div className="flex gap-2 rounded-lg border p-1 bg-muted/40">
              <button
                type="button"
                onClick={() => setDialogType("ledger")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors
                  ${dialogType === "ledger" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <BookOpen className="h-3.5 w-3.5" />Ledger Account
              </button>
              <button
                type="button"
                onClick={() => setDialogType("party")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors
                  ${dialogType === "party" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Users className="h-3.5 w-3.5" />Party / Ledger
              </button>
            </div>
          )}

          {/* ---- LEDGER FORM ---- */}
          {dialogType === "ledger" && (() => {
            const isSystemEdit = editItem?.isSystem === "true";
            return (
              <div className="space-y-4 py-1">
                {isSystemEdit && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>System ledger — name and group are locked. You can set the opening balance and its Dr/Cr type.</span>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Account Name {!isSystemEdit && "*"}</Label>
                  {isSystemEdit ? (
                    <div className="h-9 flex items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                      {ledgerForm.name}
                    </div>
                  ) : (
                    <>
                      <Input
                        value={ledgerForm.name}
                        onChange={e => { setLedgerForm(p => ({ ...p, name: e.target.value })); setLedgerNameError(""); }}
                        placeholder="e.g. HDFC Bank Account"
                        autoFocus
                        className={ledgerNameError ? "border-destructive" : ""}
                      />
                      {ledgerNameError && <p className="text-xs text-destructive">{ledgerNameError}</p>}
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Account Group {!isSystemEdit && "*"}</Label>
                  {isSystemEdit ? (
                    <div className="h-9 flex items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                      {ledgerForm.group}
                    </div>
                  ) : (
                    <Select value={ledgerForm.group} onValueChange={v => {
                      const grp = (accountGroups as any[]).find((g: any) => g.name === v);
                      setLedgerForm(p => ({ ...p, group: v, nature: grp ? (grp.nature === "Asset" || grp.nature === "Expense" ? "dr" : "cr") : p.nature }));
                    }}>
                      <SelectTrigger className={!ledgerForm.group ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select group..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(accountGroups as any[]).map((g: any) => (
                          <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Opening Balance</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                      <Input className="pl-7" type="number" value={ledgerForm.openingBalance} onChange={e => setLedgerForm(p => ({ ...p, openingBalance: e.target.value }))} placeholder="0.00" autoFocus={isSystemEdit} />
                    </div>
                    <Select value={ledgerForm.nature} onValueChange={v => setLedgerForm(p => ({ ...p, nature: v }))}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dr">Dr (Debit)</SelectItem>
                        <SelectItem value="cr">Cr (Credit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {!isSystemEdit && <p className="text-xs text-muted-foreground">Dr/Cr is auto-set from the account group</p>}
                </div>


                {["Indirect Expenses", "Indirect Incomes", "Direct Expenses", "Direct Incomes", "Fixed Assets", "Purchase Accounts", "Sales Accounts"].includes(ledgerForm.group) && (
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statutory Details</p>
                    <div className="space-y-2">
                      <Label>GST Calculation Method</Label>
                      <RadioGroup
                        value={(ledgerForm as any).gstCalculationMethod || "none"}
                        onValueChange={(val) => setLedgerForm((p: any) => ({ ...p, gstCalculationMethod: val }))}
                        className="flex flex-col gap-2 mt-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="r-none" />
                          <Label htmlFor="r-none" className="font-normal cursor-pointer">Not Applicable</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="assessable_value" id="r-assessable" />
                          <Label htmlFor="r-assessable" className="font-normal cursor-pointer">GST applicable on assessable value (calculate on invoice value)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="flat_rate" id="r-flat" />
                          <Label htmlFor="r-flat" className="font-normal cursor-pointer">GST applicable on flat rate</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {((ledgerForm as any).gstCalculationMethod === "flat_rate" || (ledgerForm as any).isGstApplicable) && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="space-y-1">
                          <Label>GST Rate (%)</Label>
                          <Input
                            type="number"
                            value={(ledgerForm as any).gstRate}
                            onChange={e => setLedgerForm((p: any) => ({ ...p, gstRate: e.target.value }))}
                            placeholder="e.g. 18"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>HSN / SAC</Label>
                          <Input
                            value={(ledgerForm as any).hsnSac}
                            onChange={e => setLedgerForm((p: any) => ({ ...p, hsnSac: e.target.value }))}
                            placeholder="e.g. 9983"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {ledgerForm.group === "Bank Accounts" && (
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bank Details</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>Bank Name</Label>
                        <Input
                          value={(ledgerForm as any).bankName}
                          onChange={e => setLedgerForm((p: any) => ({ ...p, bankName: e.target.value }))}
                          placeholder="e.g. HDFC Bank"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Branch</Label>
                        <Input
                          value={(ledgerForm as any).bankBranch}
                          onChange={e => setLedgerForm((p: any) => ({ ...p, bankBranch: e.target.value }))}
                          placeholder="e.g. Connaught Place"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Account Number</Label>
                      <Input
                        value={(ledgerForm as any).accountNumber}
                        onChange={e => setLedgerForm((p: any) => ({ ...p, accountNumber: e.target.value }))}
                        placeholder="Enter account number"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label>IFSC Code</Label>
                        <Input
                          value={(ledgerForm as any).ifscCode}
                          onChange={e => setLedgerForm((p: any) => ({ ...p, ifscCode: e.target.value.toUpperCase() }))}
                          placeholder="e.g. HDFC0001234"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>UPI ID</Label>
                        <Input
                          value={(ledgerForm as any).upiId}
                          onChange={e => setLedgerForm((p: any) => ({ ...p, upiId: e.target.value }))}
                          placeholder="e.g. business@upi"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ---- PARTY FORM ---- */}
          {dialogType === "party" && !editItem && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Basic Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Name *</Label>
                    <Input
                      value={partyForm.name}
                      onChange={e => setParty("name", e.target.value)}
                      placeholder="Party / Company name"
                      className={partyErrors.name ? "border-destructive" : ""}
                      autoFocus
                    />
                    {partyErrors.name && <p className="text-xs text-destructive">{partyErrors.name}</p>}
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Account Group *</Label>
                    <AccountGroupSelect
                      value={partyForm.accountGroup}
                      onChange={v => setParty("accountGroup", v)}
                      groups={accountGroups as any[]}
                      error={partyErrors.accountGroup}
                    />
                    {partyErrors.accountGroup && <p className="text-xs text-destructive">{partyErrors.accountGroup}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Mobile</Label>
                    <Input
                      value={partyForm.phone}
                      onChange={e => setParty("phone", e.target.value)}
                      placeholder="10-digit mobile"
                      maxLength={10}
                      className={partyErrors.phone ? "border-destructive" : ""}
                    />
                    {partyErrors.phone && <p className="text-xs text-destructive">{partyErrors.phone}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={partyForm.email} onChange={e => setParty("email", e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-1">
                    <Label>PAN</Label>
                    <Input value={partyForm.pan} onChange={e => setParty("pan", e.target.value.toUpperCase())} placeholder="AADCS0472N" />
                  </div>
                  <div className="space-y-1">
                    <Label>Payment Terms</Label>
                    <Input value={partyForm.paymentTerms} onChange={e => setParty("paymentTerms", e.target.value)} placeholder="e.g. Net 30 days" />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Address</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Address</Label>
                    <Input value={partyForm.address} onChange={e => setParty("address", e.target.value)} placeholder="Street / Area" />
                  </div>
                  <div className="space-y-1">
                    <Label>City</Label>
                    <Input value={partyForm.city} onChange={e => setParty("city", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>State {(partyForm.accountGroup === "Sundry Debtors" || partyForm.accountGroup === "Sundry Creditors") ? "*" : ""}</Label>
                    <Select value={partyForm.state} onValueChange={v => setParty("state", v)}>
                      <SelectTrigger className={partyErrors.state ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {partyErrors.state && <p className="text-xs text-destructive">{partyErrors.state}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Pincode</Label>
                    <Input value={partyForm.pincode} onChange={e => setParty("pincode", e.target.value)} maxLength={6} />
                  </div>
                  {isOutOfState && (
                    <div className="sm:col-span-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                      <Info className="h-4 w-4 shrink-0" />
                      Out of State party — IGST will apply on transactions
                    </div>
                  )}
                </div>
              </div>

              {/* GST Info */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">GST Information</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["registered", "unregistered", "composition"] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setParty("gstType", t)}
                      className={`rounded-lg border-2 px-2 py-2 text-xs font-medium capitalize transition-colors text-left
                        ${partyForm.gstType === t
                          ? t === "registered" ? "border-green-500 bg-green-50 text-green-800"
                          : t === "unregistered" ? "border-gray-400 bg-gray-50 text-gray-700"
                          : "border-blue-500 bg-blue-50 text-blue-800"
                          : "border-input bg-background text-muted-foreground hover:border-muted-foreground"
                        }`}
                    >
                      <span className="block font-semibold capitalize">{t}</span>
                      <span className="block text-[10px] mt-0.5 opacity-70">
                        {t === "registered" ? "Has GSTIN" : t === "unregistered" ? "No GSTIN" : "Composition"}
                      </span>
                    </button>
                  ))}
                </div>
                {needsGstin && (
                  <div className="space-y-1">
                    <Label>GSTIN *</Label>
                    <Input
                      value={partyForm.gstin}
                      onChange={e => setParty("gstin", e.target.value.toUpperCase())}
                      placeholder="27AADCS0472N1Z1"
                      className={`font-mono ${partyErrors.gstin ? "border-destructive" : ""}`}
                      maxLength={15}
                    />
                    {partyErrors.gstin && <p className="text-xs text-destructive">{partyErrors.gstin}</p>}
                    {partyForm.gstin && GSTIN_REGEX.test(partyForm.gstin) && (
                      <p className="text-xs text-green-600">✓ Valid GSTIN format</p>
                    )}
                  </div>
                )}
              </div>

              {/* Financial */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Financial</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Opening Balance</Label>
                    <Input
                      type="number"
                      min="0"
                      value={partyForm.openingBalance}
                      onChange={e => setParty("openingBalance", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Balance Type</Label>
                    <Select value={partyForm.balanceType} onValueChange={v => setParty("balanceType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dr">Dr — Receivable</SelectItem>
                        <SelectItem value="cr">Cr — Payable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Credit Limit</p>
                      <p className="text-xs text-muted-foreground">Maximum outstanding allowed</p>
                    </div>
                    <Switch checked={partyForm.creditLimitEnabled} onCheckedChange={v => setParty("creditLimitEnabled", v)} />
                  </div>
                  {partyForm.creditLimitEnabled && (
                    <div className="space-y-1">
                      <Label className="text-xs">Credit Limit Amount (₹)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={partyForm.creditLimit}
                        onChange={e => setParty("creditLimit", e.target.value)}
                        placeholder="e.g. 50000"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editItem ? "Update" : dialogType === "party" ? "Create Ledger" : "Create Account"}
            </Button>
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
