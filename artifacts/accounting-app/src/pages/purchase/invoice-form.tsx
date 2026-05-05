import { useState, useEffect } from "react";
import { useCreatePurchaseInvoice, useGetPurchaseInvoice, useListParties, useListStockItems, useCreateStockItem, getListPurchaseInvoicesQueryKey, getListStockItemsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Lock, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Item { stockItemId?: number; itemName: string; hsnCode: string; quantity: number; unit: string; rate: number; discountPct: number; gstPct: number; gstLocked: boolean; taxableAmount: number; cgst: number; sgst: number; igst: number; total: number; }

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
];

function calc(item: Partial<Item>, isInterstate: boolean, gstInclusive = false): Item {
  const qty = Number(item.quantity) || 0; const rate = Number(item.rate) || 0;
  const discPct = Number(item.discountPct) || 0; const gstPct = Number(item.gstPct) || 0;
  const grossAmount = qty * rate * (1 - discPct / 100);
  const taxable = (gstInclusive && gstPct > 0) ? grossAmount / (1 + gstPct / 100) : grossAmount;
  const gst = (gstInclusive && gstPct > 0) ? grossAmount - taxable : taxable * (gstPct / 100);
  return { itemName: item.itemName || "", hsnCode: item.hsnCode || "", quantity: qty, unit: item.unit || "pcs", rate, discountPct: discPct, gstPct, gstLocked: item.gstLocked ?? false, taxableAmount: taxable, cgst: isInterstate ? 0 : gst / 2, sgst: isInterstate ? 0 : gst / 2, igst: isInterstate ? gst : 0, total: taxable + gst, stockItemId: item.stockItemId };
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
  const params = useParams<{ id: string }>();
  const isEdit = !!(params?.id);
  const editId = isEdit ? Number(params.id) : undefined;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreatePurchaseInvoice();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});
  const { data: existing } = useGetPurchaseInvoice(editId!, { query: { enabled: isEdit } });

  const [partyId, setPartyId] = useState<number | undefined>();
  const [date, setDate] = useState(today());
  const [supplierInvNumber, setSupplierInvNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, false)]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForIndex, setQuickAddForIndex] = useState<number | null>(null);
  const [gstInclusive, setGstInclusive] = useState(false);

  // Payment entry
  const [payType, setPayType] = useState<"none" | "partial" | "full">("none");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");

  const selectedParty = (parties as any[]).find((p: any) => p.id === partyId);
  const isInterstate = selectedParty?.isOutOfState === "true" || selectedParty?.isOutOfState === true;

  const totals = {
    subtotal: items.reduce((s, i) => s + i.quantity * i.rate, 0),
    discount: items.reduce((s, i) => s + (i.quantity * i.rate - i.taxableAmount), 0),
    taxable: items.reduce((s, i) => s + i.taxableAmount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    grand: items.reduce((s, i) => s + i.total, 0),
  };

  const amountPaid = payType === "none" ? 0 : payType === "full" ? totals.grand : Math.min(Number(payAmount) || 0, totals.grand);
  const balanceDue = totals.grand - amountPaid;

  useEffect(() => {
    if (payType === "full") setPayAmount(totals.grand > 0 ? String(totals.grand.toFixed(2)) : "");
  }, [payType, totals.grand]);

  useEffect(() => {
    if (!existing || !isEdit) return;
    const inv = existing as any;
    if (inv.partyId) setPartyId(inv.partyId);
    if (inv.date) setDate(inv.date);
    setSupplierInvNumber(inv.supplierInvoiceNumber || "");
    setNotes(inv.notes || "");
    const interstate = inv.isInterstate === "true" || inv.isInterstate === true;
    const paid = Number(inv.amountPaid) || 0;
    const grand = Number(inv.grandTotal) || 0;
    if (paid <= 0) { setPayType("none"); }
    else if (paid >= grand) { setPayType("full"); setPayAmount(String(paid.toFixed(2))); }
    else { setPayType("partial"); setPayAmount(String(paid.toFixed(2))); }
    if (inv.payments?.length) { setPayMethod(inv.payments[0].mode || "cash"); setPayRef(inv.payments[0].reference || ""); }
    if (inv.items?.length) {
      setItems(inv.items.map((i: any) => calc({
        stockItemId: i.stockItemId, itemName: i.itemName, hsnCode: i.hsnCode || "",
        quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate),
        discountPct: Number(i.discountPct) || 0, gstPct: Number(i.gstPct) || 0,
        gstLocked: !!i.stockItemId,
      }, interstate)));
    }
  }, [existing]);

  useEffect(() => {
    setItems(prev => prev.map(item => calc(item, isInterstate, gstInclusive)));
  }, [gstInclusive]);

  const updateItem = (index: number, field: keyof Item, value: any) => {
    setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], [field]: value }, isInterstate, gstInclusive); return u; });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      const gstPct = si.gstApplicable === "true" ? Number(si.gstRate) || 0 : 0;
      setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], stockItemId: si.id, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.purchaseRate, gstPct, gstLocked: si.gstApplicable === "true" }, isInterstate, gstInclusive); return u; });
    }
  };

  const handleQuickAdded = (newItem: any) => {
    queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
    if (quickAddForIndex !== null) {
      const gstPct = newItem.gstApplicable === "true" ? Number(newItem.gstRate) || 0 : 0;
      setItems(prev => { const u = [...prev]; u[quickAddForIndex] = calc({ ...u[quickAddForIndex], stockItemId: newItem.id, itemName: newItem.name, unit: newItem.unit, rate: newItem.purchaseRate, gstPct, gstLocked: newItem.gstApplicable === "true" }, isInterstate, gstInclusive); return u; });
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
    if (payType === "partial") {
      const amt = Number(payAmount);
      if (!amt || amt <= 0) e.payment = "Enter a valid partial payment amount";
      else if (amt > totals.grand) e.payment = `Amount cannot exceed total (${formatCurrency(totals.grand)})`;
    }
    return e;
  };

  const buildPayload = () => {
    const party = (parties as any[]).find((p: any) => p.id === partyId);
    const payments = payType !== "none" && amountPaid > 0
      ? [{ mode: payMethod, amount: amountPaid, reference: payRef }]
      : [];
    return {
      date, supplierInvoiceNumber: supplierInvNumber,
      partyId, partyName: party?.name || "",
      isGst: items.some(i => i.gstPct > 0), isInterstate, isReverseCharge: false,
      subtotal: totals.subtotal, totalTaxable: totals.taxable,
      totalCgst: totals.cgst, totalSgst: totals.sgst, totalIgst: totals.igst,
      grandTotal: totals.grand, amountPaid, balanceDue,
      notes, items, payments,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSaving(true);
    try {
      if (isEdit) {
        await customFetch(`/api/purchase-invoices/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
        toast({ title: "Purchase invoice updated" });
      } else {
        await createMutation.mutateAsync({ data: buildPayload() as any });
        toast({ title: "Purchase invoice created" });
      }
      queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
      setLocation("/purchase/invoices");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/purchase/invoices"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Purchase Invoice" : "New Purchase Invoice"}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Left: Invoice details */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Supplier *</Label>
                  <Select value={partyId ? String(partyId) : ""} onValueChange={v => { setPartyId(Number(v)); setErrors(p => { const n = { ...p }; delete n.party; return n; }); }}>
                    <SelectTrigger className={errors.party ? "border-destructive" : ""}><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>{(parties as any[]).filter((p: any) => p.type === "supplier" || p.type === "both").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
                </div>
                <div className="space-y-1"><Label>Date *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className={errors.date ? "border-destructive" : ""} /></div>
                <div className="space-y-1"><Label>Supplier Invoice#</Label><Input value={supplierInvNumber} onChange={e => setSupplierInvNumber(e.target.value)} placeholder="Supplier's invoice number" /></div>
              </div>

              {isInterstate && (
                <div className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-2 rounded">Interstate supplier — IGST will apply</div>
              )}
            </CardContent>
          </Card>

          {/* Items card */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Items</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* GST Inclusive / Exclusive toggle */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <span className="text-sm font-medium">GST Type:</span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setGstInclusive(false)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${!gstInclusive ? "bg-primary text-primary-foreground" : "bg-background border"}`}>Exclusive</button>
                  <button type="button" onClick={() => setGstInclusive(true)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${gstInclusive ? "bg-primary text-primary-foreground" : "bg-background border"}`}>Inclusive</button>
                </div>
                <span className="text-xs text-muted-foreground">{gstInclusive ? "Entered price already includes GST" : "GST will be added on top of price"}</span>
              </div>

              {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}

              {/* Mobile card layout */}
              <div className="md:hidden space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-3 bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">Item {i + 1}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex gap-2">
                      <Select onValueChange={v => selectStock(i, v)}>
                        <SelectTrigger className="h-10 text-sm flex-1"><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>{(stockItems as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" title="Quick add" onClick={() => { setQuickAddForIndex(i); setQuickAddOpen(true); }}><Plus className="h-4 w-4" /></Button>
                    </div>
                    {!item.stockItemId && <Input className="h-10 text-sm" placeholder="Item name *" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />}
                    {item.stockItemId && <div className="text-sm text-muted-foreground px-1 -mt-1">{item.itemName}</div>}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Qty *</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} onChange={e => updateItem(i, "quantity", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Unit</Label>{item.stockItemId ? (<div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>) : (<Input className="h-10 text-base" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} />)}</div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Rate *</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Disc%</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">GST%</Label>{item.gstLocked ? (<div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>) : (<Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}><SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select>)}</div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Total</Label><div className="h-10 flex items-center justify-end font-bold text-base">{formatCurrency(item.total)}</div></div>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full h-10" onClick={() => setItems(prev => [...prev, calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, isInterstate)])}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Item *</TableHead>
                      <TableHead className="w-24">Qty *</TableHead>
                      <TableHead className="w-20">Unit</TableHead>
                      <TableHead className="w-28">Rate *</TableHead>
                      <TableHead className="w-20">Disc%</TableHead>
                      <TableHead className="w-24">GST%</TableHead>
                      <TableHead className="w-28 text-right">Taxable</TableHead>
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
                            <Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" title="Quick add item" onClick={() => { setQuickAddForIndex(i); setQuickAddOpen(true); }}><Plus className="h-3.5 w-3.5" /></Button>
                          </div>
                          {!item.stockItemId && <Input className="h-9 mt-1 text-sm" placeholder="Item name" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />}
                          {item.stockItemId && <div className="text-xs text-muted-foreground mt-1 px-1">{item.itemName}</div>}
                        </TableCell>
                        <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.quantity || ""} onChange={e => updateItem(i, "quantity", e.target.value)} /></TableCell>
                        <TableCell>{item.stockItemId ? (<div className="h-9 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>) : (<Input className="h-9 text-sm" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} />)}</TableCell>
                        <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                        <TableCell><Input className="h-9 text-sm" type="number" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} /></TableCell>
                        <TableCell>{item.gstLocked ? (<div className="h-9 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>) : (<Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select>)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(item.taxableAmount)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                        <TableCell><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setItems(prev => [...prev, calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, isInterstate)])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-1"><Label>Notes</Label><Textarea placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Totals + Payment */}
        <div className="space-y-4">
          {/* Totals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Totals</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {totals.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatCurrency(totals.discount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span>{formatCurrency(totals.taxable)}</span></div>
              {!isInterstate && totals.cgst > 0 && <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{formatCurrency(totals.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{formatCurrency(totals.sgst)}</span></div>
              </>}
              {isInterstate && totals.igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{formatCurrency(totals.igst)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span>{formatCurrency(totals.grand)}</span></div>
            </CardContent>
          </Card>

          {/* Payment Entry */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-primary">Payment Entry</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* None / Partial / Full tabs */}
              <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-lg">
                {(["none", "partial", "full"] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => {
                      setPayType(t);
                      setErrors(p => { const n = { ...p }; delete n.payment; return n; });
                      if (t === "full") setPayAmount(String(totals.grand.toFixed(2)));
                      if (t === "none") setPayAmount("");
                    }}
                    className={`py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${payType === t ? "bg-white dark:bg-zinc-800 shadow text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                    {t === "none" ? "No Payment" : t === "partial" ? "Partial" : "Full"}
                  </button>
                ))}
              </div>

              {payType !== "none" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Amount Paid *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                      <Input className="pl-7 h-10 text-base font-semibold" type="number" inputMode="decimal" min="0" step="any"
                        value={payAmount}
                        onChange={e => { setPayAmount(e.target.value); if (payType === "full") setPayType("partial"); setErrors(p => { const n = { ...p }; delete n.payment; return n; }); }}
                        placeholder="0.00" readOnly={payType === "full"} />
                    </div>
                    {errors.payment && <p className="text-xs text-destructive">{errors.payment}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Payment Mode</Label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Reference / Cheque No. (optional)</Label>
                    <Input className="h-9 text-sm" placeholder="e.g. UTR, Cheque no." value={payRef} onChange={e => setPayRef(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span className="font-semibold text-green-600">{formatCurrency(amountPaid)}</span></div>
                <div className="flex justify-between font-bold"><span>Balance Due</span><span className={balanceDue > 0 ? "text-red-600" : "text-green-600"}>{formatCurrency(balanceDue)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2 border-t">
        <Button type="submit" disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />{isSaving ? "Saving..." : isEdit ? "Update Invoice" : "Save Invoice"}
        </Button>
      </div>

      <QuickAddItemDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={handleQuickAdded} />
    </form>
  );
}
