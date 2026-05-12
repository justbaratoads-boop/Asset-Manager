import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useGetParty, useGetCompanySettings, getListPartiesQueryKey, customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INDIAN_STATES } from "@/lib/format";
import { ArrowLeft, Plus, Trash2, History, Info, Lock, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

type GstHistoryEntry = { id: string; fromDate: string; toDate: string; gstType: string; gstin: string };

const BLANK_FORM = {
  name: "", accountGroup: "Sundry Debtors",
  gstType: "unregistered",
  address: "", city: "", state: "", pincode: "",
  gstin: "", pan: "", phone: "", email: "",
  openingBalance: "", balanceType: "dr",
  creditLimitEnabled: false, creditLimit: "",
};

function useAccountGroups() {
  return useQuery({
    queryKey: ["account-groups"],
    queryFn: () => customFetch<any[]>("/api/account-groups"),
  });
}

// Searchable account group combobox
function AccountGroupSelect({ value, onChange, groups, error }: {
  value: string; onChange: (v: string) => void; groups: any[]; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = groups.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

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
        className={`w-full flex items-center justify-between h-10 rounded-md border px-3 py-2 text-sm bg-background ring-offset-background
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
          <div className="max-h-52 overflow-y-auto py-1">
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

export default function PartyForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: existing } = useGetParty(editId!, { query: { enabled: isEdit } } as any);
  const { data: companySettings } = useGetCompanySettings();
  const { data: accountGroups = [] } = useAccountGroups();

  const [form, setForm] = useState(BLANK_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasInvoices, setHasInvoices] = useState(false);

  const [gstHistory, setGstHistory] = useState<GstHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyForm, setHistoryForm] = useState<Omit<GstHistoryEntry, "id">>({ fromDate: "", toDate: "", gstType: "registered", gstin: "" });

  const companyState = (companySettings as any)?.state || "";
  const isOutOfState = companyState && form.state && companyState !== form.state;

  useEffect(() => {
    if (!existing) return;
    const e = existing as any;
    setForm({
      name: e.name || "",
      accountGroup: e.accountGroup || "Sundry Debtors",
      gstType: e.gstType || "unregistered",
      address: e.address || "",
      city: e.city || "",
      state: e.state || "",
      pincode: e.pincode || "",
      gstin: e.gstin || "",
      pan: e.pan || "",
      phone: e.phone || "",
      email: e.email || "",
      openingBalance: String(e.openingBalance || ""),
      balanceType: e.balanceType || "dr",
      creditLimitEnabled: e.creditLimitEnabled === "true" || e.creditLimitEnabled === true,
      creditLimit: e.creditLimit ? String(e.creditLimit) : "",
    });
    setGstHistory(Array.isArray(e.gstHistory) ? e.gstHistory : []);
  }, [existing]);

  const set = (k: string, v: string | boolean) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.accountGroup) e.accountGroup = "Account group is required";
    if (!form.state) e.state = "State is required";
    if (form.phone && !/^\d{10}$/.test(form.phone)) e.phone = "Phone must be exactly 10 digits";
    if (form.gstType !== "unregistered") {
      if (!form.gstin) e.gstin = "GSTIN is required";
      else if (!GSTIN_REGEX.test(form.gstin.toUpperCase())) e.gstin = "Invalid GSTIN format";
    }
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSaving(true);
    const payload = {
      ...form,
      gstin: form.gstType !== "unregistered" ? form.gstin.toUpperCase() : undefined,
      openingBalance: Number(form.openingBalance) || 0,
      creditLimitEnabled: form.creditLimitEnabled,
      creditLimit: form.creditLimitEnabled && form.creditLimit ? Number(form.creditLimit) : undefined,
      gstHistory,
    };
    try {
      if (isEdit) {
        await customFetch(`/api/parties/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Ledger updated" });
      } else {
        await customFetch("/api/parties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Ledger created" });
      }
      queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
      setLocation("/accounts/parties");
    } catch (err: any) {
      const code = err?.data?.code || err?.response?.data?.code;
      const msg = err?.data?.error || err?.response?.data?.error || err.message || "Failed to save";
      if (code === "DUPLICATE_NAME") {
        setErrors(prev => ({ ...prev, name: msg }));
      } else if (code === "HAS_INVOICES") {
        setHasInvoices(true);
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const addGstHistoryEntry = () => {
    if (!historyForm.fromDate || !historyForm.gstType) return;
    setGstHistory(prev => [
      ...prev,
      { ...historyForm, id: crypto.randomUUID(), gstin: historyForm.gstType === "unregistered" ? "" : historyForm.gstin },
    ]);
    setHistoryForm({ fromDate: "", toDate: "", gstType: "registered", gstin: "" });
  };

  const removeGstHistoryEntry = (id: string) => {
    setGstHistory(prev => prev.filter(e => e.id !== id));
  };

  const needsGstin = form.gstType === "registered" || form.gstType === "composition";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/accounts/parties">
          <Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        </Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Ledger" : "New Ledger"}</h1>
      </div>

      {/* Invoice-locked banner */}
      {hasInvoices && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <Lock className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">This ledger cannot be edited</p>
            <p className="text-destructive/80 mt-0.5">Invoices have already been generated for this ledger. To maintain accounting accuracy, editing is not allowed.</p>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Party / Company name"
              className={errors.name ? "border-destructive" : ""}
              disabled={hasInvoices}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-1 col-span-2">
            <Label>Account Group *</Label>
            <AccountGroupSelect
              value={form.accountGroup}
              onChange={v => set("accountGroup", v)}
              groups={accountGroups as any[]}
              error={errors.accountGroup}
            />
            {errors.accountGroup && <p className="text-xs text-destructive">{errors.accountGroup}</p>}
          </div>

          <div className="space-y-1">
            <Label>Mobile</Label>
            <Input
              value={form.phone}
              onChange={e => set("phone", e.target.value)}
              placeholder="10-digit mobile number"
              maxLength={10}
              className={errors.phone ? "border-destructive" : ""}
              disabled={hasInvoices}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" disabled={hasInvoices} />
          </div>

          <div className="space-y-1">
            <Label>PAN</Label>
            <Input value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())} placeholder="AADCS0472N" disabled={hasInvoices} />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street / Area" disabled={hasInvoices} />
          </div>
          <div className="space-y-1">
            <Label>City</Label>
            <Input value={form.city} onChange={e => set("city", e.target.value)} disabled={hasInvoices} />
          </div>
          <div className="space-y-1">
            <Label>State *</Label>
            <Select value={form.state} onValueChange={v => set("state", v)} disabled={hasInvoices}>
              <SelectTrigger className={errors.state ? "border-destructive" : ""}>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
          </div>
          <div className="space-y-1">
            <Label>Pincode</Label>
            <Input value={form.pincode} onChange={e => set("pincode", e.target.value)} maxLength={6} disabled={hasInvoices} />
          </div>
          {isOutOfState && (
            <div className="col-span-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <Info className="h-4 w-4 shrink-0" />
              Out of State party — IGST will apply on transactions
            </div>
          )}
        </CardContent>
      </Card>

      {/* GST Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">GST Information</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="h-3.5 w-3.5 mr-1.5" />
              GST History {gstHistory.length > 0 && <Badge variant="secondary" className="ml-1.5">{gstHistory.length}</Badge>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(["registered", "unregistered", "composition"] as const).map(t => (
              <button
                key={t}
                type="button"
                disabled={hasInvoices}
                onClick={() => set("gstType", t)}
                className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium capitalize transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed
                  ${form.gstType === t
                    ? t === "registered" ? "border-green-500 bg-green-50 text-green-800"
                    : t === "unregistered" ? "border-gray-400 bg-gray-50 text-gray-700"
                    : "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-input bg-background text-muted-foreground hover:border-muted-foreground"
                  }`}
              >
                <span className="block font-semibold capitalize">{t}</span>
                <span className="block text-xs mt-0.5 opacity-70">
                  {t === "registered" ? "Has GSTIN" : t === "unregistered" ? "No GSTIN" : "Composition dealer"}
                </span>
              </button>
            ))}
          </div>

          {needsGstin && (
            <div className="space-y-1">
              <Label>GSTIN *</Label>
              <Input
                value={form.gstin}
                onChange={e => set("gstin", e.target.value.toUpperCase())}
                placeholder="27AADCS0472N1Z1"
                className={`font-mono ${errors.gstin ? "border-destructive" : ""}`}
                maxLength={15}
                disabled={hasInvoices}
              />
              {errors.gstin && <p className="text-xs text-destructive">{errors.gstin}</p>}
              {form.gstin && GSTIN_REGEX.test(form.gstin) && (
                <p className="text-xs text-green-600">✓ Valid GSTIN format</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial */}
      <Card>
        <CardHeader><CardTitle className="text-base">Financial</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Opening Balance</Label>
              <Input
                type="number"
                min="0"
                value={form.openingBalance}
                onChange={e => set("openingBalance", e.target.value)}
                placeholder="0.00"
                disabled={hasInvoices}
              />
            </div>
            <div className="space-y-1">
              <Label>Balance Type</Label>
              <Select value={form.balanceType} onValueChange={v => set("balanceType", v)} disabled={hasInvoices}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dr">Dr — Amount receivable</SelectItem>
                  <SelectItem value="cr">Cr — Amount payable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Credit Limit</p>
                <p className="text-xs text-muted-foreground">Control the maximum outstanding allowed</p>
              </div>
              <Switch checked={form.creditLimitEnabled} onCheckedChange={v => set("creditLimitEnabled", v)} disabled={hasInvoices} />
            </div>
            {form.creditLimitEnabled && (
              <div className="space-y-1">
                <Label className="text-xs">Credit Limit Amount (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.creditLimit}
                  onChange={e => set("creditLimit", e.target.value)}
                  placeholder="e.g. 50000"
                  disabled={hasInvoices}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!hasInvoices && (
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : isEdit ? "Update Ledger" : "Create Ledger"}
        </Button>
      )}

      {/* GST History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>GST History</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Track when this party changed their GST registration status.</p>

          {gstHistory.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gstHistory.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm">{entry.fromDate}</TableCell>
                    <TableCell className="text-sm">{entry.toDate || "Present"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        entry.gstType === "registered" ? "text-green-700 border-green-300" :
                        entry.gstType === "composition" ? "text-blue-700 border-blue-300" :
                        "text-gray-600 border-gray-300"
                      }>
                        {entry.gstType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.gstin || "—"}</TableCell>
                    <TableCell>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeGstHistoryEntry(entry.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Add Entry</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">From Date *</Label>
                <Input type="date" value={historyForm.fromDate} onChange={e => setHistoryForm(p => ({ ...p, fromDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Date (blank = ongoing)</Label>
                <Input type="date" value={historyForm.toDate} onChange={e => setHistoryForm(p => ({ ...p, toDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GST Status</Label>
                <Select value={historyForm.gstType} onValueChange={v => setHistoryForm(p => ({ ...p, gstType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="registered">Registered</SelectItem>
                    <SelectItem value="unregistered">Unregistered</SelectItem>
                    <SelectItem value="composition">Composition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {historyForm.gstType !== "unregistered" && (
                <div className="space-y-1">
                  <Label className="text-xs">GSTIN</Label>
                  <Input
                    value={historyForm.gstin}
                    onChange={e => setHistoryForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                    placeholder="27AADCS0472N1Z1"
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </div>
            <Button type="button" size="sm" onClick={addGstHistoryEntry} disabled={!historyForm.fromDate}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setHistoryOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
