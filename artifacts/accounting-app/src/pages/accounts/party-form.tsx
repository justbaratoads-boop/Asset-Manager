import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateParty, getListPartiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PartyForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateParty();
  const [form, setForm] = useState({ name: "", type: "customer", address: "", city: "", state: "", pincode: "", gstin: "", pan: "", phone: "", email: "", openingBalance: "", balanceType: "dr", creditLimit: "" });
  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({ data: { ...form, openingBalance: Number(form.openingBalance) || 0, creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined } as any });
      queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
      toast({ title: "Party created" });
      setLocation("/accounts/parties");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
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
          <div className="space-y-1 col-span-2"><Label>Name *</Label><Input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Party name" /></div>
          <div className="space-y-1"><Label>Type</Label><Select value={form.type} onValueChange={v => set("type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customer">Customer</SelectItem><SelectItem value="supplier">Supplier</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
          <div className="space-y-1 col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
          <div className="space-y-1"><Label>GSTIN</Label><Input value={form.gstin} onChange={e => set("gstin", e.target.value)} placeholder="27AADCS0472N1Z1" /></div>
          <div className="space-y-1"><Label>PAN</Label><Input value={form.pan} onChange={e => set("pan", e.target.value)} /></div>
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
        <CardHeader><CardTitle className="text-base">Financial</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-1"><Label>Opening Balance</Label><Input type="number" value={form.openingBalance} onChange={e => set("openingBalance", e.target.value)} /></div>
          <div className="space-y-1"><Label>Balance Type</Label><Select value={form.balanceType} onValueChange={v => set("balanceType", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dr">Dr (Receivable)</SelectItem><SelectItem value="cr">Cr (Payable)</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>Credit Limit</Label><Input type="number" value={form.creditLimit} onChange={e => set("creditLimit", e.target.value)} placeholder="Optional" /></div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Create Party"}</Button>
    </form>
  );
}
