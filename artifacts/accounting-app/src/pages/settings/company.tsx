import { useState, useEffect, useRef } from "react";
import { useGetCompanySettings, useUpdateCompanySettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Image } from "lucide-react";

export default function CompanySettings() {
  const { data: settings } = useGetCompanySettings();
  const updateMutation = useUpdateCompanySettings();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "", address: "", city: "", state: "", pincode: "", country: "India",
    gstin: "", pan: "", phone: "", email: "", website: "",
    bankName: "", bankAccount: "", bankIfsc: "", bankBranch: "",
    currency: "INR", financialYearStart: "04",
    invoicePrefix: "INV", poPrefix: "PO", paymentTerms: "",
    billFooter: "", logoUrl: "",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (settings) setForm(f => ({ ...f, ...(settings as any) }));
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast({ title: "Logo must be under 500KB", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { set("logoUrl", ev.target?.result as string); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({ data: form as any });
    toast({ title: "Company settings saved" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Company Settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Company Logo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {form.logoUrl ? (
              <div className="relative">
                <img src={form.logoUrl} alt="Company logo" className="h-20 w-auto max-w-[200px] object-contain border rounded-md p-2 bg-white" />
                <button type="button" onClick={() => { set("logoUrl", ""); if (fileRef.current) fileRef.current.value = ""; }} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-40 border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground">
                <Image className="h-8 w-8" />
              </div>
            )}
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" />
                {form.logoUrl ? "Change Logo" : "Upload Logo"}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG up to 500KB. Shown on all printed invoices.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2"><Label>Company Name *</Label><Input required value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="space-y-1"><Label>GSTIN</Label><Input value={form.gstin} onChange={e => set("gstin", e.target.value.toUpperCase())} placeholder="27AADCS0472N1Z1" /></div>
          <div className="space-y-1"><Label>PAN</Label><Input value={form.pan} onChange={e => set("pan", e.target.value.toUpperCase())} /></div>
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
          <div className="space-y-1"><Label>State</Label>
            <Select value={form.state} onValueChange={v => set("state", v)}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Pincode</Label><Input value={form.pincode} onChange={e => set("pincode", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bank Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Bank Name</Label><Input value={form.bankName} onChange={e => set("bankName", e.target.value)} /></div>
          <div className="space-y-1"><Label>Account Number</Label><Input value={form.bankAccount} onChange={e => set("bankAccount", e.target.value)} /></div>
          <div className="space-y-1"><Label>IFSC Code</Label><Input value={form.bankIfsc} onChange={e => set("bankIfsc", e.target.value.toUpperCase())} /></div>
          <div className="space-y-1"><Label>Branch</Label><Input value={form.bankBranch} onChange={e => set("bankBranch", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Invoice Preferences</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Invoice Prefix</Label><Input value={form.invoicePrefix} onChange={e => set("invoicePrefix", e.target.value)} /></div>
          <div className="space-y-1"><Label>PO Prefix</Label><Input value={form.poPrefix} onChange={e => set("poPrefix", e.target.value)} /></div>
          <div className="space-y-1"><Label>Financial Year Start</Label>
            <Select value={form.financialYearStart} onValueChange={v => set("financialYearStart", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="04">April (Recommended for India)</SelectItem>
                <SelectItem value="01">January</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Payment Terms</Label><Input value={form.paymentTerms} onChange={e => set("paymentTerms", e.target.value)} placeholder="e.g. Net 30 days" /></div>
          <div className="space-y-1 col-span-2">
            <Label>Bill Footer / Thank You Message</Label>
            <Textarea value={form.billFooter || ""} onChange={e => set("billFooter", e.target.value)} placeholder="e.g. Thank you for your business! All disputes subject to local jurisdiction." rows={2} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "Saving..." : "Save Settings"}</Button>
    </form>
  );
}
