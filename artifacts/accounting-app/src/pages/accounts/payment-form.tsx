import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCreatePayment, useGetPayment, useListParties, useListLedgers, getListPaymentsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PartySelect } from "@/components/party-select";
import { today, formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, ListChecks, CheckSquare, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BillEntry {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  balanceDue: number;
  amount: number;
}

export default function PaymentForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreatePayment();
  const { data: allParties = [] } = useListParties();
  const { data: allLedgers = [] } = useListLedgers({});
  const { data: existing } = useGetPayment(editId!, { query: { enabled: isEdit } });

  const cashBankLedgers = (allLedgers as any[]).filter(
    (l: any) => l.group === "Bank Accounts" || l.name === "Cash"
  );
  const parties = (allParties as any[]).filter(
    (p: any) => p.accountGroup === "Sundry Creditors" || p.type === "supplier" || p.type === "both"
  );

  const [partyId, setPartyId] = useState<number | undefined>();
  const [form, setForm] = useState({ date: today(), ledgerId: "", amount: "", narration: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Bill-wise state
  const [billWiseOpen, setBillWiseOpen] = useState(false);
  const [billWiseEntries, setBillWiseEntries] = useState<BillEntry[]>([]);
  const [pendingBills, setPendingBills] = useState<any[]>([]);
  const [billAmounts, setBillAmounts] = useState<Record<number, string>>({});
  const [loadingBills, setLoadingBills] = useState(false);

  useEffect(() => {
    if (!existing) return;
    const e = existing as any;
    setPartyId(e.partyId || undefined);
    setForm({ date: e.date || today(), ledgerId: e.ledgerId ? String(e.ledgerId) : "", amount: String(e.amount || ""), narration: e.narration || "" });
  }, [existing]);

  const handlePartyChange = useCallback((id: number) => {
    setPartyId(id);
    setBillWiseEntries([]);
    setForm(p => ({ ...p, amount: "" }));
  }, []);

  const openBillWise = async () => {
    if (!partyId) return;
    setLoadingBills(true);
    setBillAmounts({});
    const existing_amounts: Record<number, string> = {};
    billWiseEntries.forEach(e => { existing_amounts[e.invoiceId] = String(e.amount || ""); });
    try {
      const [confirmed, partial] = await Promise.all([
        customFetch<any[]>(`/api/purchase-invoices?partyId=${partyId}&status=confirmed`),
        customFetch<any[]>(`/api/purchase-invoices?partyId=${partyId}&status=partial`),
      ]);
      const bills = [...(confirmed || []), ...(partial || [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setPendingBills(bills);
      const amounts: Record<number, string> = {};
      bills.forEach((b: any) => { amounts[b.id] = existing_amounts[b.id] || ""; });
      setBillAmounts(amounts);
    } catch {
      toast({ title: "Failed to load pending bills", variant: "destructive" });
    } finally {
      setLoadingBills(false);
    }
    setBillWiseOpen(true);
  };

  const applyBillWise = () => {
    const entries: BillEntry[] = pendingBills
      .filter((b: any) => Number(billAmounts[b.id] || 0) > 0)
      .map((b: any) => ({
        invoiceId: b.id,
        invoiceNumber: b.invoiceNumber,
        invoiceDate: b.date,
        grandTotal: b.grandTotal,
        balanceDue: b.balanceDue,
        amount: Math.min(Number(billAmounts[b.id]), b.balanceDue),
      }));
    const total = entries.reduce((s, e) => s + e.amount, 0);
    setBillWiseEntries(entries);
    setForm(p => ({ ...p, amount: total > 0 ? String(total) : p.amount }));
    setBillWiseOpen(false);
  };

  const billWiseTotal = Object.values(billAmounts).reduce((s, v) => s + (Number(v) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const party = parties.find((p: any) => p.id === partyId);
    const payload: any = {
      date: form.date,
      partyId: partyId || undefined,
      partyName: party?.name,
      ledgerId: Number(form.ledgerId),
      amount: Number(form.amount),
      narration: form.narration,
    };
    if (billWiseEntries.length > 0) {
      payload.billWiseEntries = billWiseEntries.map(e => ({ invoiceId: e.invoiceId, amount: e.amount }));
    }
    try {
      if (isEdit) {
        await customFetch(`/api/payments/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Payment voucher updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Payment voucher created" });
      }
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
      setLocation("/accounts/payments");
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error || "Failed to save", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/accounts/payments"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Payment Voucher" : "New Payment Voucher"}</h1>
      </div>
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Amount *</Label>
            <Input
              type="number" required inputMode="decimal" min="0" step="any"
              value={form.amount} onChange={e => { set("amount", e.target.value); setBillWiseEntries([]); }}
              placeholder="0.00"
              readOnly={billWiseEntries.length > 0}
              className={billWiseEntries.length > 0 ? "bg-muted cursor-not-allowed" : ""}
            />
            {billWiseEntries.length > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                Applied to {billWiseEntries.length} bill{billWiseEntries.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Party (Sundry Creditor)</Label>
            <PartySelect value={partyId} onChange={handlePartyChange} parties={parties} placeholder="Select supplier / party (optional)" />
          </div>

          {/* Bill-wise button */}
          {partyId && !isEdit && (
            <div className="sm:col-span-2">
              <Button type="button" variant="outline" size="sm" onClick={openBillWise} className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                <ListChecks className="h-4 w-4" />
                Bill-wise Entry
                {billWiseEntries.length > 0 && (
                  <Badge className="ml-1 bg-blue-100 text-blue-700 border-0 text-xs">{billWiseEntries.length} bill{billWiseEntries.length > 1 ? "s" : ""}</Badge>
                )}
              </Button>
              {billWiseEntries.length > 0 && (
                <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-2.5 space-y-1">
                  {billWiseEntries.map(e => (
                    <div key={e.invoiceId} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-blue-700">{e.invoiceNumber}</span>
                      <span className="text-muted-foreground">{formatDate(e.invoiceDate)}</span>
                      <span className="font-semibold text-blue-800">{formatCurrency(e.amount)}</span>
                    </div>
                  ))}
                  <div className="border-t border-blue-200 pt-1 flex justify-between text-xs font-semibold text-blue-800">
                    <span>Total</span>
                    <span>{formatCurrency(billWiseEntries.reduce((s, e) => s + e.amount, 0))}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1 sm:col-span-2">
            <Label>Payment Ledger *</Label>
            <Select value={form.ledgerId} onValueChange={v => set("ledgerId", v)} required>
              <SelectTrigger><SelectValue placeholder="Select cash / bank account" /></SelectTrigger>
              <SelectContent>{cashBankLedgers.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2"><Label>Narration</Label><Input value={form.narration} onChange={e => set("narration", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending || !form.ledgerId}>
        {createMutation.isPending ? "Saving..." : isEdit ? "Update Payment" : "Save Payment"}
      </Button>

      {/* Bill-wise Dialog */}
      <Dialog open={billWiseOpen} onOpenChange={setBillWiseOpen}>
        <DialogContent className="w-[95vw] max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle className="text-base">Bill-wise Entry — Pending Bills</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            {loadingBills ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading pending bills...</div>
            ) : pendingBills.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No pending bills found for this party.</div>
            ) : (
              <div className="divide-y">
                {pendingBills.map((bill: any) => {
                  const entered = Number(billAmounts[bill.id] || 0);
                  const hasAmount = entered > 0;
                  return (
                    <div key={bill.id} className={`px-4 py-3 ${hasAmount ? "bg-green-50" : ""}`}>
                      {/* Top row: checkbox + invoice# + date */}
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => setBillAmounts(p => ({ ...p, [bill.id]: hasAmount ? "" : String(bill.balanceDue) }))}
                          className="shrink-0"
                        >
                          {hasAmount
                            ? <CheckSquare className="h-4 w-4 text-green-600" />
                            : <Square className="h-4 w-4 text-muted-foreground" />
                          }
                        </button>
                        <span className="font-mono text-xs font-semibold flex-1">{bill.invoiceNumber}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(bill.date)}</span>
                      </div>
                      {/* Bottom row: totals + amount input */}
                      <div className="flex items-center gap-2 pl-6">
                        <div className="flex-1 text-xs text-muted-foreground">
                          Total: <span className="font-medium text-foreground">{formatCurrency(bill.grandTotal)}</span>
                        </div>
                        <div className="text-xs text-amber-600 font-medium">
                          Due: {formatCurrency(bill.balanceDue)}
                        </div>
                        <Input
                          type="number" min="0" step="any" inputMode="decimal"
                          max={bill.balanceDue}
                          placeholder="0.00"
                          value={billAmounts[bill.id] || ""}
                          onChange={e => setBillAmounts(p => ({ ...p, [bill.id]: e.target.value }))}
                          className="h-8 text-right text-xs w-24 shrink-0"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {pendingBills.length > 0 && (
            <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center justify-between text-sm font-semibold">
              <span className="text-muted-foreground text-xs">
                {Object.values(billAmounts).filter(v => Number(v) > 0).length} bill{Object.values(billAmounts).filter(v => Number(v) > 0).length !== 1 ? "s" : ""} selected
              </span>
              <span>Total: {formatCurrency(billWiseTotal)}</span>
            </div>
          )}
          <DialogFooter className="px-4 py-3 border-t gap-2 flex-row justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setBillWiseOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={applyBillWise} disabled={billWiseTotal <= 0}>
              Apply — {formatCurrency(billWiseTotal)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
