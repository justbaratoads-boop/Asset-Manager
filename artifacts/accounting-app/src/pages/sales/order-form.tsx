import { useState, useEffect } from "react";
import { useCreateOrder, useGetOrder, useListParties, useListStockItems, useCreateStockItem, getListOrdersQueryKey, getListStockItemsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Lock } from "lucide-react";
import { UnitSelect } from "@/components/unit-select";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  stockItemId?: number;
  itemName: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPct: number;
  gstPct: number;
  gstLocked: boolean;
  gstInclusive: boolean;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

function calcItem(item: Partial<OrderItem>): OrderItem {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const discPct = Number(item.discountPct) || 0;
  const gstPct = Number(item.gstPct) || 0;
  const gstInclusive = item.gstInclusive ?? false;
  const grossAmount = qty * rate * (1 - discPct / 100);
  const taxable = (gstInclusive && gstPct > 0) ? grossAmount / (1 + gstPct / 100) : grossAmount;
  const gst = (gstInclusive && gstPct > 0) ? grossAmount - taxable : taxable * (gstPct / 100);
  return {
    stockItemId: item.stockItemId,
    itemName: item.itemName || "",
    hsnCode: item.hsnCode || "",
    quantity: qty, unit: item.unit || "pcs", rate,
    discountPct: discPct, gstPct,
    gstLocked: item.gstLocked ?? false,
    gstInclusive,
    taxableAmount: taxable,
    cgst: gst / 2, sgst: gst / 2, igst: 0,
    total: taxable + gst,
  };
}

function GstToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex rounded overflow-hidden border text-xs font-medium">
      <button type="button" onClick={() => onChange(false)}
        className={`px-1.5 py-0.5 transition-colors ${!value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
        Ex
      </button>
      <button type="button" onClick={() => onChange(true)}
        className={`px-1.5 py-0.5 border-l transition-colors ${value ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
        In
      </button>
    </div>
  );
}

function QuickAddItemDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (item: any) => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [saleRate, setSaleRate] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const createItem = useCreateStockItem();
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Item name is required", variant: "destructive" }); return; }
    try {
      const item = await createItem.mutateAsync({ data: { name: name.trim(), unit, saleRate: saleRate || "0", purchaseRate: "0", gstApplicable: "true", gstRate, openingStock: "0", minStockLevel: "0" } as any });
      toast({ title: `Item "${name}" added` });
      onAdded(item);
      setName(""); setUnit("pcs"); setSaleRate(""); setGstRate("18");
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
          <div className="space-y-1"><Label>Sale Rate</Label><Input type="number" value={saleRate} onChange={e => setSaleRate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={createItem.isPending}>{createItem.isPending ? "Adding..." : "Add Item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OrderForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!(params?.id);
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateOrder();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});
  const { data: existing } = useGetOrder(editId!, { query: { enabled: isEdit } });

  const [partyId, setPartyId] = useState<number | undefined>();
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [date, setDate] = useState(today());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18, gstInclusive: false })]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForIndex, setQuickAddForIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!existing || !isEdit) return;
    const o = existing as any;
    if (o.partyId) setPartyId(o.partyId);
    setPartyName(o.partyName || "");
    setPartyPhone(o.partyPhone || "");
    setDeliveryAddress(o.deliveryAddress || "");
    if (o.date) setDate(o.date);
    setDeliveryDate(o.deliveryDate || "");
    setNotes(o.notes || "");
    setDriverName(o.driverName || "");
    setVehicleName(o.vehicleName || "");
    setVehicleNo(o.vehicleNo || "");
    setDispatchNotes(o.dispatchNotes || "");
    if (o.items?.length) {
      setItems(o.items.map((i: any) => calcItem({
        stockItemId: i.stockItemId, itemName: i.itemName, hsnCode: i.hsnCode || "",
        quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate),
        discountPct: Number(i.discountPct) || 0, gstPct: Number(i.gstPct) || 0,
        gstLocked: !!i.stockItemId, gstInclusive: false,
      })));
    }
  }, [existing]);

  const grandTotal = items.reduce((s, i) => s + i.total, 0);

  const selectParty = (id: string) => {
    const p = (parties as any[]).find((p: any) => p.id === Number(id));
    if (p) {
      setPartyId(p.id); setPartyName(p.name); setPartyPhone(p.phone || "");
      setDeliveryAddress([p.address, p.city, p.state, p.pincode].filter(Boolean).join(", "));
      setErrors(prev => { const n = { ...prev }; delete n.party; return n; });
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], [field]: value }); return u; });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      const gstPct = si.gstApplicable === "true" ? Number(si.gstRate) || 0 : 0;
      setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], stockItemId: si.id, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.saleRate, gstPct, gstLocked: si.gstApplicable === "true" }); return u; });
    }
  };

  const handleQuickAdded = (newItem: any) => {
    queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
    if (quickAddForIndex !== null) {
      const gstPct = newItem.gstApplicable === "true" ? Number(newItem.gstRate) || 0 : 0;
      setItems(prev => { const u = [...prev]; u[quickAddForIndex] = calcItem({ ...u[quickAddForIndex], stockItemId: newItem.id, itemName: newItem.name, unit: newItem.unit, rate: newItem.saleRate, gstPct, gstLocked: newItem.gstApplicable === "true" }); return u; });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!partyId) e.party = "Party is required";
    if (!date) e.date = "Date is required";
    if (items.length === 0) e.items = "At least one item is required";
    if (items.some(i => !i.itemName)) e.items = "All items must have a name";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const payload = { date, partyId, partyName, partyPhone, deliveryAddress, notes, driverName, vehicleName, vehicleNo, dispatchNotes, deliveryDate: deliveryDate || undefined, grandTotal, items };
    try {
      if (isEdit) {
        await customFetch(`/api/orders/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Order updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Order created" });
      }
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      setLocation("/sales/orders");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Failed to save order";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales/orders"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <h1 className="text-xl font-bold">{isEdit ? "Edit Order" : "New Order"}</h1>
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving..." : isEdit ? "Update Order" : "Save Order"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Party & Date</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Party *</Label>
            <Select value={partyId ? String(partyId) : ""} onValueChange={selectParty}>
              <SelectTrigger className={errors.party ? "border-destructive" : ""}><SelectValue placeholder="Select party" /></SelectTrigger>
              <SelectContent>{(parties as any[]).filter((p: any) => p.type === "customer" || p.type === "both").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
          </div>
          <div className="space-y-1"><Label>Order Date *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className={errors.date ? "border-destructive" : ""} /></div>
          <div className="space-y-1"><Label>Delivery Date</Label><Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={partyPhone} onChange={e => setPartyPhone(e.target.value)} placeholder="Auto-filled from party" /></div>
          <div className="space-y-1 col-span-2"><Label>Delivery Address</Label><Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Auto-filled from party" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
        <CardContent>
          {errors.items && <p className="text-xs text-destructive mb-2">{errors.items}</p>}

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
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Qty</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="0" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Unit</Label>
                    {item.stockItemId ? (
                      <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>
                    ) : (
                      <UnitSelect value={item.unit} onChange={v => updateItem(i, "unit", v)} className="h-10" />
                    )}
                  </div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Rate</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} placeholder="0.00" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Disc%</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} placeholder="0" /></div>
                  {/* Per-item GST Type toggle */}
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">GST Type</Label>
                    <div className="flex rounded-md overflow-hidden border text-sm font-medium h-10">
                      <button type="button" onClick={() => updateItem(i, "gstInclusive", false)}
                        className={`flex-1 transition-colors ${!item.gstInclusive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                        Exclusive
                      </button>
                      <button type="button" onClick={() => updateItem(i, "gstInclusive", true)}
                        className={`flex-1 border-l transition-colors ${item.gstInclusive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                        Inclusive
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">GST%</Label>
                    {item.gstLocked ? (
                      <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>
                    ) : (
                      <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Total</Label><div className="h-10 flex items-center justify-end font-bold text-base">{formatCurrency(item.total)}</div></div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" className="h-10 flex-1" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18, gstInclusive: false })])}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
            </div>
            <div className="font-bold text-right text-base pt-1">Total: {formatCurrency(grandTotal)}</div>
          </div>

          {/* Desktop table layout */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Item</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="w-20">Unit</TableHead>
                  <TableHead className="w-28">Rate</TableHead>
                  <TableHead className="w-20">Disc%</TableHead>
                  <TableHead className="w-32">GST Type / %</TableHead>
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
                      <UnitSelect value={item.unit} onChange={v => updateItem(i, "unit", v)} className="h-9" />
                    )}</TableCell>
                    <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-9 text-sm" type="number" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} /></TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <GstToggle value={item.gstInclusive} onChange={v => updateItem(i, "gstInclusive", v)} />
                        {item.gstLocked ? (
                          <div className="h-8 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>
                        ) : (
                          <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                    <TableCell><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18, gstInclusive: false })])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
              <div className="font-bold">Total: {formatCurrency(grandTotal)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Dispatch Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Driver Name</Label><Input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Optional" /></div>
          <div className="space-y-1"><Label>Vehicle Name</Label><Input value={vehicleName} onChange={e => setVehicleName(e.target.value)} placeholder="e.g. Tempo, Truck" /></div>
          <div className="space-y-1"><Label>Vehicle No.</Label><Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value.toUpperCase())} placeholder="MH12AB1234" /></div>
          <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="General notes" /></div>
          <div className="space-y-1 col-span-2"><Label>Dispatch Notes</Label><Textarea value={dispatchNotes} onChange={e => setDispatchNotes(e.target.value)} placeholder="Special dispatch instructions..." rows={2} /></div>
        </CardContent>
      </Card>

      <QuickAddItemDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={handleQuickAdded} />
    </form>
  );
}
