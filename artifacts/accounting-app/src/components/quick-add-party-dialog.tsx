import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customFetch, getListPartiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  phone: "", state: "", gstType: "unregistered", gstin: "",
};

export function QuickAddPartyDialog({ open, onOpenChange, defaultAccountGroup, onCreated }: QuickAddPartyDialogProps) {
  const [form, setForm] = useState({ ...BLANK, accountGroup: defaultAccountGroup || "Sundry Debtors" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const set = (k: string, v: string) => {
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
          ...form,
          gstin: needsGstin ? form.gstin.toUpperCase() : undefined,
          openingBalance: 0,
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
      toast({ title: `Party "${form.name}" created` });
      onCreated(party);
      onOpenChange(false);
      setForm({ ...BLANK, accountGroup: defaultAccountGroup || "Sundry Debtors" });
      setErrors({});
    } catch (err: any) {
      const msg = err?.data?.error || err.message || "Failed to create";
      if (err?.data?.code === "DUPLICATE_NAME") setErrors({ name: "A party with this name already exists" });
      else toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!saving) { onOpenChange(o); if (!o) { setForm({ ...BLANK, accountGroup: defaultAccountGroup || "Sundry Debtors" }); setErrors({}); } } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Party</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input autoFocus value={form.name} onChange={e => set("name", e.target.value)} placeholder="Party / Company name" className={errors.name ? "border-destructive" : ""} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Account Group</Label>
              <Select value={form.accountGroup} onValueChange={v => set("accountGroup", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sundry Debtors">Sundry Debtors</SelectItem>
                  <SelectItem value="Sundry Creditors">Sundry Creditors</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Accounts">Bank Accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Mobile</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit" maxLength={10} className={errors.phone ? "border-destructive" : ""} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label>State *</Label>
            <Select value={form.state} onValueChange={v => set("state", v)}>
              <SelectTrigger className={errors.state ? "border-destructive" : ""}><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
          </div>

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
              <Input value={form.gstin} onChange={e => set("gstin", e.target.value.toUpperCase())} placeholder="27AADCS0472N1Z1" className={`font-mono ${errors.gstin ? "border-destructive" : ""}`} maxLength={15} />
              {errors.gstin && <p className="text-xs text-destructive">{errors.gstin}</p>}
              {form.gstin && GSTIN_REGEX.test(form.gstin) && <p className="text-xs text-green-600">✓ Valid GSTIN</p>}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Party"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
