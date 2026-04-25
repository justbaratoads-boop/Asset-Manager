import { useState, useEffect } from "react";
import { useGetCompanySettings, useUpdateCompanySettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

export default function CompanySettings() {
  const { data: settings } = useGetCompanySettings();
  const updateMutation = useUpdateCompanySettings();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "", pincode: "", country: "India", gstin: "", pan: "", phone: "", email: "", website: "", bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "", currency: "INR", financialYearStart: "04", invoicePrefix: "INV", poPrefix: "PO", paymentTerms: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (settings) setForm(f => ({ ...f, ...(settings as any) }));
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({ data: form as any });
    toast({ title: "Company settings saved" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Company Settings</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2"><Label>Company Name *</Label><Input required value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="space-y-1"><Label>GSTIN</Label><Input value={form.gstin} onChange={e => set("gstin", e.target.value)} placeholder="27AADCS0472N1Z1" /></div>
          <div className="space-y-1"><Label>PAN</Label><Input value={form.pan} onChange={e => set("pan", e.target.value)} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
          <div className="space-y-1 col-span-2"><Label>Website</Label><Input value={form.website} onChange={e => set("website", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => set("address", e.target.value)} /></div>
          <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={e => set("city", e.target.value)} /></div>
          <div className="space-y-1"><Label>State</Label><Select value={form.state} onValueChange={v => set("state", v)}><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger><SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Pincode</Label><Input value={form.pincode} onChange={e => set("pincode", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Bank Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Bank Name</Label><Input value={form.bankName} onChange={e => set("bankName", e.target.value)} /></div>
          <div className="space-y-1"><Label>Account Number</Label><Input value={form.bankAccount} onChange={e => set("bankAccount", e.target.value)} /></div>
          <div className="space-y-1"><Label>IFSC Code</Label><Input value={form.bankIfsc} onChange={e => set("bankIfsc", e.target.value)} /></div>
          <div className="space-y-1"><Label>Branch</Label><Input value={form.bankBranch} onChange={e => set("bankBranch", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Preferences</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-1"><Label>Invoice Prefix</Label><Input value={form.invoicePrefix} onChange={e => set("invoicePrefix", e.target.value)} /></div>
          <div className="space-y-1"><Label>PO Prefix</Label><Input value={form.poPrefix} onChange={e => set("poPrefix", e.target.value)} /></div>
          <div className="space-y-1"><Label>Financial Year Start</Label><Select value={form.financialYearStart} onValueChange={v => set("financialYearStart", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="04">April</SelectItem><SelectItem value="01">January</SelectItem></SelectContent></Select></div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Settings"}</Button>
    </form>
  );
}
