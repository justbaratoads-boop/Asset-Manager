import { useState } from "react";
import { useCreatePurchaseInvoice, useListParties, useListStockItems, useCreateStockItem, getListPurchaseInvoicesQueryKey, getListStockItemsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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

function QuickAddItemDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (item: any) => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const createItem = useCreateStockItem();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Item name is required", variant: "destructive" }); return; }
    try {
      const item = await createItem.mutateAsync({ data: { name: name.trim(), unit, saleRate: "0", purchaseRate: purchaseRate || "0", gstApplicable: "true", gstRate, openingStock: "0", minStockLevel: "0" } as any });
      toast({ title: `Item "${name}" added` });
      onAdded(item);
      setName(""); setUnit("pcs"); setPurchaseRate(""); setGstRate("18");
      onClose();
    } catch { toast({ title: "Failed to add item", variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Quick Add Item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Item Name *</Label><Input value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Unit</Label><Input value={unit} onChange={e => setUnit(e.target.value)} /></div>
            <div className="space-y-1"><Label>GST %</Label><Select value={gstRate} onValueChange={setGstRate}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1"><Label>Purchase Rate</Label><Input type="number" value={purchaseRate} onChange={e => setPurchaseRate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={createItem.isPending}>{createItem.isPending ? "Adding..." : "Add Item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [items, setItems] = useState<Item[]>([calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, false)]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForIndex, setQuickAddForIndex] = useState<number | null>(null);

  const selectedParty = (parties as any[]).find((p: any) => p.id === partyId);
  const isInterstate = selectedParty?.isOutOfState === "true" || selectedParty?.isOutOfState === true;

  const totals = {
    taxable: items.reduce((s, i) => s + i.taxableAmount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    grand: items.reduce((s, i) => s + i.total, 0),
  };

  const updateItem = (index: number, field: keyof Item, value: any) => {
    setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], [field]: value }, isInterstate); return u; });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      const gstPct = si.gstApplicable === "true" ? Number(si.gstRate) || 0 : 0;
      setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], stockItemId: si.id, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.purchaseRate, gstPct }, isInterstate); return u; });
    }
  };

  const handleQuickAdded = (newItem: any) => {
    queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
    if (quickAddForIndex !== null) {
      const gstPct = newItem.gstApplicable === "true" ? Number(newItem.gstRate) || 0 : 0;
      setItems(prev => { const u = [...prev]; u[quickAddForIndex] = calc({ ...u[quickAddForIndex], stockItemId: newItem.id, itemName: newItem.name, unit: newItem.unit, rate: newItem.purchaseRate, gstPct }, isInterstate); return u; });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!partyId) e.party = "Supplier is required";
    if (!date) e.date = "Date is required";
    for (let i = 0; i < items.length; i++) {
      if (!items[i].itemName) { e.items = `Row ${i + 1}: Item name is required`; break; }
      if (!items[i].quantity || items[i].quantity <= 0) { e.items = `Row ${i + 1}: Quantity required`; break; }
      if (!items[i].rate || items[i].rate <= 0) { e.items = `Row ${i + 1}: Rate required`; break; }
    }
    if (items.length === 0) e.items = "Add at least one item";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const party = (parties as any[]).find((p: any) => p.id === partyId);
    try {
      await createMutation.mutateAsync({ data: { date, supplierInvoiceNumber: supplierInvNumber, partyId, partyName: party?.name || "", isGst: true, isInterstate, isReverseCharge: false, ...totals, totalCgst: totals.cgst, totalSgst: totals.sgst, totalIgst: totals.igst, subtotal: totals.grand, totalTaxable: totals.taxable, grandTotal: totals.grand, amountPaid: paymentAmount, balanceDue: totals.grand - paymentAmount, items, payments: paymentAmount > 0 ? [{ mode: paymentMode, amount: paymentAmount }] : [] } as any });
      queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
      toast({ title: "Purchase invoice created" });
      setLocation("/purchase/invoices");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/purchase/invoices"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">New Purchase Invoice</h1>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Supplier *</Label>
              <Select onValueChange={v => { setPartyId(Number(v)); setErrors(p => { const n = { ...p }; delete n.party; return n; }); }}>
                <SelectTrigger className={errors.party ? "border-destructive" : ""}><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{(parties as any[]).filter((p: any) => p.type === "supplier" || p.type === "both").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
            </div>
            <div className="space-y-1"><Label>Date *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Supplier Invoice#</Label><Input value={supplierInvNumber} onChange={e => setSupplierInvNumber(e.target.value)} placeholder="Supplier's invoice number" /></div>
          </div>

          {selectedParty?.isOutOfState === "true" && (
            <div className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-2 rounded">Interstate supplier — IGST will apply</div>
          )}

          {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Item *</TableHead>
                <TableHead className="w-24">Qty *</TableHead>
                <TableHead className="w-20">Unit</TableHead>
                <TableHead className="w-28">Rate *</TableHead>
                <TableHead className="w-20">Disc%</TableHead>
                <TableHead className="w-24">GST%</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex gap-1 items-center">
                      <Select onValueChange={v => selectStock(i, v)}>
                        <SelectTrigger className="h-9 text-sm flex-1"><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>{(stockItems as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" title="Quick add item" onClick={() => { setQuickAddForIndex(i); setQuickAddOpen(true); }}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {!item.stockItemId && <Input className="h-9 mt-1 text-sm" placeholder="Item name" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />}
                    {item.stockItemId && <div className="text-xs text-muted-foreground mt-1 px-1">{item.itemName}</div>}
                  </TableCell>
                  <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.quantity || ""} onChange={e => updateItem(i, "quantity", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-9 text-sm" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-9 text-sm" type="number" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} /></TableCell>
                  <TableCell><Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select></TableCell>
                  <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  <TableCell><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
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
              {!isInterstate ? <>
                <div className="flex gap-8 justify-end"><span>CGST</span><span>{formatCurrency(totals.cgst)}</span></div>
                <div className="flex gap-8 justify-end"><span>SGST</span><span>{formatCurrency(totals.sgst)}</span></div>
              </> : (
                <div className="flex gap-8 justify-end"><span>IGST</span><span>{formatCurrency(totals.igst)}</span></div>
              )}
              <div className="flex gap-8 justify-end font-bold text-base"><span>Total</span><span>{formatCurrency(totals.grand)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Save Invoice"}</Button>
      <QuickAddItemDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={handleQuickAdded} />
    </form>
  );
}
