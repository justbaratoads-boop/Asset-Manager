import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { customFetch, getListPartiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { INDIAN_STATES } from "@/lib/format";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

interface QuickAddPartyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAccountGroup?: string;
  onCreated: (party: { id: number; name: string; phone?: string; gstin?: string; isOutOfState?: string }) => void;
}

const BLANK = {
  name: "", accountGroup: "Sundry Debtors",
  phone: "", email: "", pan: "",
  address: "", city: "", state: "", pincode: "",
  gstType: "unregistered", gstin: "",
  paymentTerms: "",
  openingBalance: "", balanceType: "dr",
  creditLimitEnabled: false, creditLimit: "",
};

function useAccountGroups() {
  return useQuery({
    queryKey: ["account-groups"],
    queryFn: () => customFetch<any[]>("/api/account-groups"),
    staleTime: 5 * 60 * 1000,
  });
}

export function QuickAddPartyDialog({ open, onOpenChange, defaultAccountGroup, onCreated }: QuickAddPartyDialogProps) {
  const [form, setForm] = useState({ ...BLANK, accountGroup: defaultAccountGroup || "Sundry Debtors" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: accountGroups = [] } = useAccountGroups();

  const set = (k: string, v: string | boolean) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  const needsGstin = form.gstType === "registered" || form.gstType === "composition";

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.state) e.state = "State is required";
    if (form.phone && !/^\d{10}$/.test(form.phone)) e.phone = "Must be 10 digits";
    if (needsGstin) {
      if (!form.gstin) e.gstin = "GSTIN is required";
      else if (!GSTIN_REGEX.test(form.gstin.toUpperCase())) e.gstin = "Invalid GSTIN format";
    }
    return e;
  };

  const handleClose = () => {
    if (saving) return;
    onOpenChange(false);
    setForm({ ...BLANK, accountGroup: defaultAccountGroup || "Sundry Debtors" });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const party = await customFetch<any>("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          accountGroup: form.accountGroup,
          phone: form.phone || undefined,
          email: form.email || undefined,
          pan: form.pan || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state,
          pincode: form.pincode || undefined,
          gstType: form.gstType,
          gstin: needsGstin ? form.gstin.toUpperCase() : undefined,
          paymentTerms: form.paymentTerms || undefined,
          openingBalance: Number(form.openingBalance) || 0,
          balanceType: form.balanceType,
          creditLimitEnabled: form.creditLimitEnabled,
          creditLimit: form.creditLimitEnabled && form.creditLimit ? Number(form.creditLimit) : undefined,
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
      toast({ title: `Party "${form.name}" created` });
      onCreated(party);
      handleClose();
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to create";
      if (err?.data?.code === "DUPLICATE_NAME") setErrors({ name: "A party with this name already exists" });
      else toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const groupOptions = (accountGroups as any[]).length > 0
    ? (accountGroups as any[]).map((g: any) => ({ value: g.name, label: g.name }))
    : [
        { value: "Sundry Debtors", label: "Sundry Debtors" },
        { value: "Sundry Creditors", label: "Sundry Creditors" },
        { value: "Cash", label: "Cash" },
        { value: "Bank Accounts", label: "Bank Accounts" },
      ];

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Party</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Basic Info */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</p>

            <div className="space-y-1">
              <Label>Name *</Label>
              <Input autoFocus value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="Party / Company name" className={errors.name ? "border-destructive" : ""} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-1">
              <Label>Account Group</Label>
              <Select value={form.accountGroup} onValueChange={v => set("accountGroup", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groupOptions.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Mobile</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)}
                  placeholder="10-digit" maxLength={10} className={errors.phone ? "border-destructive" : ""} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                  placeholder="email@example.com" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>PAN</Label>
              <Input value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())}
                placeholder="AADCS0472N" maxLength={10} />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</p>

            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street / Area" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={e => set("pincode", e.target.value)} maxLength={6} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>State *</Label>
              <Select value={form.state} onValueChange={v => set("state", v)}>
                <SelectTrigger className={errors.state ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
            </div>
          </div>

          {/* GST */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GST Information</p>

            <div className="space-y-1">
              <Label>GST Type</Label>
              <div className="flex gap-2">
                {(["unregistered", "registered", "composition"] as const).map(t => (
                  <button key={t} type="button" onClick={() => set("gstType", t)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors
                      ${form.gstType === t ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:border-muted-foreground"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {needsGstin && (
              <div className="space-y-1">
                <Label>GSTIN *</Label>
                <Input value={form.gstin} onChange={e => set("gstin", e.target.value.toUpperCase())}
                  placeholder="27AADCS0472N1Z1" className={`font-mono ${errors.gstin ? "border-destructive" : ""}`} maxLength={15} />
                {errors.gstin && <p className="text-xs text-destructive">{errors.gstin}</p>}
                {form.gstin && GSTIN_REGEX.test(form.gstin) && <p className="text-xs text-green-600">✓ Valid GSTIN</p>}
              </div>
            )}
          </div>

          {/* Financial */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial</p>

            <div className="space-y-1">
              <Label>Payment Terms</Label>
              <Input value={form.paymentTerms} onChange={e => set("paymentTerms", e.target.value)}
                placeholder="e.g. Net 30 days, Due on receipt" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Opening Balance</Label>
                <Input type="number" min="0" value={form.openingBalance}
                  onChange={e => set("openingBalance", e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Balance Type</Label>
                <Select value={form.balanceType} onValueChange={v => set("balanceType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dr">Dr — Receivable</SelectItem>
                    <SelectItem value="cr">Cr — Payable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Credit Limit</p>
                  <p className="text-xs text-muted-foreground">Max outstanding allowed</p>
                </div>
                <Switch checked={form.creditLimitEnabled} onCheckedChange={v => set("creditLimitEnabled", v)} />
              </div>
              {form.creditLimitEnabled && (
                <div className="space-y-1">
                  <Label className="text-xs">Credit Limit Amount (₹)</Label>
                  <Input type="number" min="0" value={form.creditLimit}
                    onChange={e => set("creditLimit", e.target.value)} placeholder="e.g. 50000" />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Party"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
