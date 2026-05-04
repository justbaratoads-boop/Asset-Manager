import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCreatePayment, useGetPayment, useListParties, useListLedgers, getListPaymentsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { today } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PaymentForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreatePayment();
  const { data: parties = [] } = useListParties();
  const { data: ledgers = [] } = useListLedgers({});
  const { data: existing } = useGetPayment(editId!, { query: { enabled: isEdit } });

  const [form, setForm] = useState({
    date: today(), partyId: "", ledgerId: "", paymentMode: "cash",
    amount: "", narration: "", reference: "",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!existing) return;
    const e = existing as any;
    setForm({
      date: e.date || today(),
      partyId: e.partyId ? String(e.partyId) : "",
      ledgerId: e.ledgerId ? String(e.ledgerId) : "",
      paymentMode: e.paymentMode || "cash",
      amount: String(e.amount || ""),
      narration: e.narration || "",
      reference: e.reference || "",
    });
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const party = (parties as any[]).find((p: any) => p.id === Number(form.partyId));
    const payload = {
      date: form.date,
      partyId: form.partyId ? Number(form.partyId) : undefined,
      partyName: party?.name,
      ledgerId: Number(form.ledgerId),
      paymentMode: form.paymentMode,
      amount: Number(form.amount),
      narration: form.narration,
      reference: form.reference,
    };
    try {
      if (isEdit) {
        await customFetch(`/api/payments/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Payment voucher updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Payment voucher created" });
      }
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      setLocation("/accounts/payments");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/accounts/payments"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Payment Voucher" : "New Payment Voucher"}</h1>
      </div>
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
          <div className="space-y-1"><Label>Amount *</Label><Input type="number" required value={form.amount} onChange={e => set("amount", e.target.value)} /></div>
          <div className="space-y-1 col-span-2">
            <Label>Party</Label>
            <Select value={form.partyId} onValueChange={v => set("partyId", v)}>
              <SelectTrigger><SelectValue placeholder="Select party (optional)" /></SelectTrigger>
              <SelectContent>{(parties as any[]).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Payment Ledger *</Label>
            <Select value={form.ledgerId} onValueChange={v => set("ledgerId", v)} required>
              <SelectTrigger><SelectValue placeholder="Select ledger" /></SelectTrigger>
              <SelectContent>{(ledgers as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.group})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Payment Mode</Label>
            <Select value={form.paymentMode} onValueChange={v => set("paymentMode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["cash", "upi", "cheque", "bank_transfer"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Reference</Label><Input value={form.reference} onChange={e => set("reference", e.target.value)} placeholder="Cheque no., UTR..." /></div>
          <div className="space-y-1 col-span-2"><Label>Narration</Label><Input value={form.narration} onChange={e => set("narration", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending || !form.ledgerId}>
        {createMutation.isPending ? "Saving..." : isEdit ? "Update Payment" : "Save Payment"}
      </Button>
    </form>
  );
}
