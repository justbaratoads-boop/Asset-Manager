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
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Item { stockItemId?: number; itemName: string; hsnCode: string; quantity: number; unit: string; rate: number; discountPct: number; gstPct: number; gstLocked: boolean; taxableAmount: number; cgst: number; sgst: number; igst: number; total: number; }

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
  const [items, setItems] = useState<Item[]>([calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, false)]);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForIndex, setQuickAddForIndex] = useState<number | null>(null);
  const [gstInclusive, setGstInclusive] = useState(false);

  useEffect(() => {
    if (!existing || !isEdit) return;
    const inv = existing as any;
    if (inv.partyId) setPartyId(inv.partyId);
    if (inv.date) setDate(inv.date);
    setSupplierInvNumber(inv.supplierInvoiceNumber || "");
    setPaymentAmount(inv.amountPaid || 0);
    if (inv.payments?.length) setPaymentMode(inv.payments[0].mode || "cash");
    const interstate = inv.isInterstate === "true" || inv.isInterstate === true;
    if (inv.items?.length) {
      setItems(inv.items.map((i: any) => calc({
        stockItemId: i.stockItemId,
        itemName: i.itemName,
        hsnCode: i.hsnCode || "",
        quantity: Number(i.quantity),
        unit: i.unit,
        rate: Number(i.rate),
        discountPct: Number(i.discountPct) || 0,
        gstPct: Number(i.gstPct) || 0,
        gstLocked: !!i.stockItemId,
      }, interstate)));
    }
  }, [existing]);

  useEffect(() => {
    setItems(prev => prev.map(item => calc(item, isInterstate, gstInclusive)));
  }, [gstInclusive]);

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
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const party = (parties as any[]).find((p: any) => p.id === partyId);
    const payload = { date, supplierInvoiceNumber: supplierInvNumber, partyId, partyName: party?.name || "", isGst: true, isInterstate, isReverseCharge: false, ...totals, totalCgst: totals.cgst, totalSgst: totals.sgst, totalIgst: totals.igst, subtotal: totals.grand, totalTaxable: totals.taxable, grandTotal: totals.grand, amountPaid: paymentAmount, balanceDue: totals.grand - paymentAmount, items, payments: paymentAmount > 0 ? [{ mode: paymentMode, amount: paymentAmount }] : [] };
    try {
      if (isEdit) {
        await customFetch(`/api/purchase-invoices/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Purchase invoice updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Purchase invoice created" });
      }
      queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
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
        <h1 className="text-xl font-bold">{isEdit ? "Edit Purchase Invoice" : "New Purchase Invoice"}</h1>
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
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Qty *</Label>
                    <Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Unit</Label>
                    {item.stockItemId ? (
                      <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>
                    ) : (
                      <Input className="h-10 text-base" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Rate *</Label>
                    <Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Disc%</Label>
                    <Input className="h-10 text-base" type="number" inputMode="decimal" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">GST%</Label>
                    {item.gstLocked ? (
                      <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>
                    ) : (
                      <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Total</Label>
                    <div className="h-10 flex items-center justify-end font-bold text-base">{formatCurrency(item.total)}</div>
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" className="w-full h-10" onClick={() => setItems(prev => [...prev, calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, isInterstate)])}>
              <Plus className="h-4 w-4 mr-2" />Add Item
            </Button>
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
                    <TableCell>{item.stockItemId ? (
                      <div className="h-9 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>
                    ) : (
                      <Input className="h-9 text-sm" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} />
                    )}</TableCell>
                    <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-9 text-sm" type="number" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} /></TableCell>
                    <TableCell>{item.gstLocked ? (
                      <div className="h-9 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>
                    ) : (
                      <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select>
                    )}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                    <TableCell><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setItems(prev => [...prev, calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, isInterstate)])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
          </div>

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
      <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : isEdit ? "Update Invoice" : "Save Invoice"}</Button>
      <QuickAddItemDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={handleQuickAdded} />
    </form>
  );
}
