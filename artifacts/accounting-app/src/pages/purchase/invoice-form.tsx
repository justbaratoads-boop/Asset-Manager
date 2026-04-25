import { useState } from "react";
import { useCreatePurchaseInvoice, useListParties, useListStockItems, getListPurchaseInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Item { stockItemId?: number; itemName: string; hsnCode: string; quantity: number; unit: string; rate: number; discountPct: number; gstPct: number; taxableAmount: number; cgst: number; sgst: number; igst: number; total: number; }

function calc(item: Partial<Item>, isInterstate: boolean): Item {
  const qty = Number(item.quantity) || 0; const rate = Number(item.rate) || 0;
  const discPct = Number(item.discountPct) || 0; const gstPct = Number(item.gstPct) || 0;
  const taxable = qty * rate * (1 - discPct / 100);
  const gst = taxable * (gstPct / 100);
  return { itemName: item.itemName || "", hsnCode: item.hsnCode || "", quantity: qty, unit: item.unit || "pcs", rate, discountPct: discPct, gstPct, taxableAmount: taxable, cgst: isInterstate ? 0 : gst / 2, sgst: isInterstate ? 0 : gst / 2, igst: isInterstate ? gst : 0, total: taxable + gst, stockItemId: item.stockItemId };
}

export default function PurchaseInvoiceForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreatePurchaseInvoice();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});
  const [partyId, setPartyId] = useState<number | undefined>();
  const [date, setDate] = useState(today());
  const [supplierInvNumber, setSupplierInvNumber] = useState("");
  const [isInterstate, setIsInterstate] = useState(false);
  const [isReverseCharge, setIsReverseCharge] = useState(false);
  const [items, setItems] = useState<Item[]>([calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, false)]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");

  const totals = { taxable: items.reduce((s, i) => s + i.taxableAmount, 0), cgst: items.reduce((s, i) => s + i.cgst, 0), sgst: items.reduce((s, i) => s + i.sgst, 0), igst: items.reduce((s, i) => s + i.igst, 0), grand: items.reduce((s, i) => s + i.total, 0) };

  const updateItem = (index: number, field: keyof Item, value: any) => { setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], [field]: value }, isInterstate); return u; }); };
  const selectStock = (index: number, id: string) => { const si = (stockItems as any[]).find((s: any) => s.id === Number(id)); if (si) setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], stockItemId: si.id, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.purchaseRate }, isInterstate); return u; }); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const party = (parties as any[]).find((p: any) => p.id === partyId);
    try {
      await createMutation.mutateAsync({ data: { date, supplierInvoiceNumber: supplierInvNumber, partyId, partyName: party?.name || "", isGst: true, isInterstate, isReverseCharge, ...totals, totalCgst: totals.cgst, totalSgst: totals.sgst, totalIgst: totals.igst, subtotal: totals.grand, totalTaxable: totals.taxable, grandTotal: totals.grand, amountPaid: paymentAmount, balanceDue: totals.grand - paymentAmount, items, payments: paymentAmount > 0 ? [{ mode: paymentMode, amount: paymentAmount }] : [] } as any });
      queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
      toast({ title: "Purchase invoice created" });
      setLocation("/purchase/invoices");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/purchase/invoices"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <h1 className="text-xl font-bold">New Purchase Invoice</h1>
        </div>
        <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Save"}</Button>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Supplier</Label>
              <Select onValueChange={v => setPartyId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{(parties as any[]).filter((p: any) => p.type === "supplier" || p.type === "both").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Supplier Invoice#</Label><Input value={supplierInvNumber} onChange={e => setSupplierInvNumber(e.target.value)} placeholder="Supplier's invoice number" /></div>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2"><Switch checked={isInterstate} onCheckedChange={v => { setIsInterstate(v); setItems(prev => prev.map(i => calc(i, v))); }} id="pi" /><Label htmlFor="pi">Interstate</Label></div>
            <div className="flex items-center gap-2"><Switch checked={isReverseCharge} onCheckedChange={setIsReverseCharge} id="rc" /><Label htmlFor="rc">Reverse Charge</Label></div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>GST%</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select onValueChange={v => selectStock(i, v)}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Item" /></SelectTrigger><SelectContent>{(stockItems as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select>
                    <Input className="h-7 mt-1 text-xs" placeholder="Name" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />
                  </TableCell>
                  <TableCell><Input className="h-7 text-xs" type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-7 text-xs" type="number" value={item.rate} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                  <TableCell><Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select></TableCell>
                  <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  <TableCell><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, isInterstate)])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
          <div className="flex justify-between items-end pt-4 border-t">
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              <div className="space-y-1"><Label>Amount Paid</Label><Input type="number" value={paymentAmount || ""} onChange={e => setPaymentAmount(Number(e.target.value))} /></div>
              <div className="space-y-1"><Label>Mode</Label><Select value={paymentMode} onValueChange={setPaymentMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["cash","upi","cheque","bank_transfer"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="text-right space-y-1 text-sm">
              <div className="flex gap-8 justify-end"><span>CGST</span><span>{formatCurrency(totals.cgst)}</span></div>
              <div className="flex gap-8 justify-end"><span>SGST</span><span>{formatCurrency(totals.sgst)}</span></div>
              <div className="flex gap-8 justify-end font-bold text-base"><span>Total</span><span>{formatCurrency(totals.grand)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
