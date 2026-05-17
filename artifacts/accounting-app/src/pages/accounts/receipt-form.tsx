import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCreateReceipt, useGetReceipt, useListParties, useListLedgers, getListReceiptsQueryKey, customFetch } from "@workspace/api-client-react";
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

export default function ReceiptForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateReceipt();
  const { data: allParties = [] } = useListParties();
  const { data: allLedgers = [] } = useListLedgers({});
  const { data: existing } = useGetReceipt(editId!, { query: { enabled: isEdit } });

  const cashBankLedgers = (allLedgers as any[]).filter(
    (l: any) => l.group === "Bank Accounts" || l.name === "Cash"
  );
  const parties = (allParties as any[]).filter(
    (p: any) => p.accountGroup === "Sundry Debtors" || p.type === "customer" || p.type === "both"
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

  // When party changes, clear bill-wise entries
  const handlePartyChange = useCallback((id: number) => {
    setPartyId(id);
    setBillWiseEntries([]);
    setForm(p => ({ ...p, amount: "" }));
  }, []);

  const openBillWise = async () => {
    if (!partyId) return;
    setLoadingBills(true);
    setBillAmounts({});
    // Pre-fill from existing entries
    const existing_amounts: Record<number, string> = {};
    billWiseEntries.forEach(e => { existing_amounts[e.invoiceId] = String(e.amount || ""); });
    try {
      const [confirmed, partial] = await Promise.all([
        customFetch<any[]>(`/api/sale-invoices?partyId=${partyId}&status=confirmed`),
        customFetch<any[]>(`/api/sale-invoices?partyId=${partyId}&status=partial`),
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
        await customFetch(`/api/receipts/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Receipt voucher updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Receipt voucher created" });
      }
      queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
      setLocation("/accounts/receipts");
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error || "Failed to save", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div className="flex items-center gap-3">
        <Link href="/accounts/receipts"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Receipt Voucher" : "New Receipt Voucher"}</h1>
      </div>
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-4">
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
          <div className="space-y-1 col-span-2">
            <Label>Party (Sundry Debtor)</Label>
            <PartySelect value={partyId} onChange={handlePartyChange} parties={parties} placeholder="Select customer / party (optional)" />
          </div>

          {/* Bill-wise button */}
          {partyId && !isEdit && (
            <div className="col-span-2">
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

          <div className="space-y-1 col-span-2">
            <Label>Receipt Ledger *</Label>
            <Select value={form.ledgerId} onValueChange={v => set("ledgerId", v)}>
              <SelectTrigger><SelectValue placeholder="Select cash / bank account" /></SelectTrigger>
              <SelectContent>{cashBankLedgers.map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2"><Label>Narration</Label><Input value={form.narration} onChange={e => set("narration", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending || !form.ledgerId}>
        {createMutation.isPending ? "Saving..." : isEdit ? "Update Receipt" : "Save Receipt"}
      </Button>

      {/* Bill-wise Dialog */}
      <Dialog open={billWiseOpen} onOpenChange={setBillWiseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bill-wise Entry — Pending Bills</DialogTitle>
          </DialogHeader>
          {loadingBills ? (
            <div className="py-8 text-center text-muted-foreground">Loading pending bills...</div>
          ) : pendingBills.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No pending bills found for this party.</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Invoice#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-32">Amount to Receive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingBills.map((bill: any, i: number) => {
                      const entered = Number(billAmounts[bill.id] || 0);
                      const hasAmount = entered > 0;
                      return (
                        <tr key={bill.id} className={`border-t ${hasAmount ? "bg-green-50" : ""}`}>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setBillAmounts(p => ({ ...p, [bill.id]: hasAmount ? "" : String(bill.balanceDue) }))}
                              className="flex items-center gap-1.5 text-left"
                            >
                              {hasAmount
                                ? <CheckSquare className="h-4 w-4 text-green-600 shrink-0" />
                                : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                              }
                              <span className="font-mono text-xs">{bill.invoiceNumber}</span>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{formatDate(bill.date)}</td>
                          <td className="px-3 py-2 text-right text-xs">{formatCurrency(bill.grandTotal)}</td>
                          <td className="px-3 py-2 text-right text-xs font-medium text-amber-600">{formatCurrency(bill.balanceDue)}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number" min="0" step="any" inputMode="decimal"
                              max={bill.balanceDue}
                              placeholder="0.00"
                              value={billAmounts[bill.id] || ""}
                              onChange={e => setBillAmounts(p => ({ ...p, [bill.id]: e.target.value }))}
                              className="h-7 text-right text-xs w-28 ml-auto"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold px-1">
                <span className="text-muted-foreground">
                  {Object.values(billAmounts).filter(v => Number(v) > 0).length} bill{Object.values(billAmounts).filter(v => Number(v) > 0).length !== 1 ? "s" : ""} selected
                </span>
                <span>Total: {formatCurrency(billWiseTotal)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBillWiseOpen(false)}>Cancel</Button>
            <Button type="button" onClick={applyBillWise} disabled={billWiseTotal <= 0}>
              Apply — {formatCurrency(billWiseTotal)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
