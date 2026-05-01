import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateParty, getListPartiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { INDIAN_STATES } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default function PartyForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateParty();
  const [form, setForm] = useState({
    name: "", type: "customer",
    gstType: "unregistered", isOutOfState: false,
    address: "", city: "", state: "", pincode: "",
    gstin: "", pan: "", phone: "", email: "",
    openingBalance: "", balanceType: "dr", creditLimit: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Party name is required";
    if (form.phone && !/^\d{10}$/.test(form.phone)) e.phone = "Phone must be exactly 10 digits";
    if (form.gstin && !GSTIN_REGEX.test(form.gstin.toUpperCase())) e.gstin = "Invalid GSTIN format (e.g. 27AADCS0472N1Z1)";
    if (form.gstType === "registered" && !form.gstin) e.gstin = "GSTIN is required for registered parties";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    try {
      await createMutation.mutateAsync({
        data: {
          ...form,
          gstin: form.gstin.toUpperCase() || undefined,
          openingBalance: Number(form.openingBalance) || 0,
          creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
          isOutOfState: form.isOutOfState,
        } as any
      });
      queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
      toast({ title: "Party created" });
      setLocation("/accounts/parties");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Failed to create party";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/accounts/parties"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">New Party</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Party name" className={errors.name ? "border-destructive" : ""} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit mobile" maxLength={10} className={errors.phone ? "border-destructive" : ""} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">GST Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>GST Type</Label>
            <Select value={form.gstType} onValueChange={v => set("gstType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="unregistered">Unregistered</SelectItem>
                <SelectItem value="composition">Composition</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>GSTIN</Label>
            <Input
              value={form.gstin}
              onChange={e => set("gstin", e.target.value.toUpperCase())}
              placeholder="27AADCS0472N1Z1"
              disabled={form.gstType === "unregistered"}
              className={errors.gstin ? "border-destructive" : ""}
            />
            {errors.gstin && <p className="text-xs text-destructive">{errors.gstin}</p>}
          </div>
          <div className="space-y-1">
            <Label>PAN</Label>
            <Input value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())} placeholder="AADCS0472N" />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch
              checked={form.isOutOfState}
              onCheckedChange={v => set("isOutOfState", v)}
            />
            <Label className="cursor-pointer">Out of State Party (IGST applies)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>City</Label>
            <Input value={form.city} onChange={e => set("city", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>State</Label>
            <Select value={form.state} onValueChange={v => set("state", v)}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Pincode</Label>
            <Input value={form.pincode} onChange={e => set("pincode", e.target.value)} maxLength={6} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Financial</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Opening Balance</Label>
            <Input type="number" value={form.openingBalance} onChange={e => set("openingBalance", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Balance Type</Label>
            <Select value={form.balanceType} onValueChange={v => set("balanceType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dr">Dr (Receivable)</SelectItem>
                <SelectItem value="cr">Cr (Payable)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Credit Limit</Label>
            <Input type="number" value={form.creditLimit} onChange={e => set("creditLimit", e.target.value)} placeholder="Optional" />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Saving..." : "Create Party"}
      </Button>
    </form>
  );
}
