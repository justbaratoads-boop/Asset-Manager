// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useCreateOrder, useGetOrder, useListParties, useListStockItems, getListOrdersQueryKey, getListStockItemsQueryKey, customFetch } from "@workspace/api-client-react";
import { useStockAvailability } from "@/hooks/use-stock-availability";
import { useFetch } from "@/hooks/use-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartySelect } from "@/components/party-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Lock, AlertTriangle } from "lucide-react";
import { getGstRateForDate } from "../../lib/gst";

import { UnitSelect } from "@/components/unit-select";
import { QuickAddPartyDialog } from "@/components/quick-add-party-dialog";
import { QuickAddItemDialog } from "@/components/quick-add-item-dialog";
import { ItemSearchCombobox } from "@/components/item-search-combobox";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  stockItemId?: number;
  batchId?: number;
  itemName: string;
  description?: string;
  hsnCode: string;
  quantity: number | string;
  unit: string;
  rate: number | string;
  discountPct: number | string;
  gstPct: number | string;
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
    batchId: item.batchId,
    itemName: item.itemName || "",
    description: item.description || "",
    hsnCode: item.hsnCode || "",
    quantity: typeof item.quantity === 'string' && item.quantity.endsWith('.') ? item.quantity : qty, unit: item.unit || "pcs", rate: typeof item.rate === 'string' && item.rate.endsWith('.') ? item.rate : rate,
    discountPct: typeof item.discountPct === 'string' && item.discountPct.endsWith('.') ? item.discountPct : discPct, gstPct,
    gstLocked: item.gstLocked ?? false,
    gstInclusive,
    taxableAmount: taxable,
    cgst: gst / 2, sgst: gst / 2, igst: 0,
    total: taxable + gst,
  };
}

function GstToggle({ value }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="h-8 flex items-center justify-center bg-muted rounded border text-xs font-medium text-muted-foreground px-2">
      {value ? "In" : "Ex"}
    </div>
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
  const stockAvail = useStockAvailability();
  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");
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
  const [items, setItems] = useState<OrderItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 18, gstInclusive: false })]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAddParty, setShowAddParty] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForIndex, setQuickAddForIndex] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!existing || !isEdit || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
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
      setItems(o.items.map((i: any) => {
        const qty = Number(i.quantity) || 0;
        const rate = Number(i.rate) || 0;
        const discPct = Number(i.discountPct) || 0;
        const grossAmount = (qty * rate) * (1 - discPct / 100);
        const taxable = Number(i.taxableAmount) || 0;
        const wasInclusive = taxable < grossAmount - 0.01 && Number(i.gstPct) > 0;
        return calcItem({
        stockItemId: i.stockItemId, batchId: i.batchId || undefined, itemName: i.itemName, description: i.description || "", hsnCode: i.hsnCode || "",
        quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate),
        discountPct: Number(i.discountPct) || 0, gstPct: Number(i.gstPct) || 0,
        gstLocked: !!i.stockItemId, gstInclusive: wasInclusive,
        });
      }));
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
      const gstPct = si.gstApplicable === "true" ? getGstRateForDate(si, date) : 0;
      setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], stockItemId: si.id, batchId: si.batchId ? Number(si.batchId) : undefined, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.saleRate, gstPct, quantity: si.unit === "n/a" ? 1 : u[index].quantity, gstLocked: true }); return u; });
    }
  };

  const clearItem = (index: number) => {
    setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], stockItemId: undefined, batchId: undefined, itemName: "", hsnCode: "", gstLocked: false }); return u; });
  };

  const handleQuickAdded = (newItem: any) => {
    queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
    if (quickAddForIndex !== null) {
      const gstPct = newItem.gstApplicable === "true" ? getGstRateForDate(newItem, date) : 0;
      setItems(prev => { const u = [...prev]; u[quickAddForIndex] = calcItem({ ...u[quickAddForIndex], stockItemId: newItem.id, batchId: newItem.batchId ? Number(newItem.batchId) : undefined, itemName: newItem.name, unit: newItem.unit, rate: newItem.saleRate, gstPct, quantity: newItem.unit === "n/a" ? 1 : u[quickAddForIndex].quantity, gstLocked: true }); return u; });
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
      const msg = err?.data?.error || "Failed to save order";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          <h1 className="text-xl font-bold">{isEdit ? "Edit Order" : "New Order"}</h1>
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving..." : isEdit ? "Update Order" : "Save Order"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Party & Date</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Party *</Label>
              <button type="button" onClick={() => setShowAddParty(true)} className="text-xs text-primary hover:underline font-medium">+ Add Party</button>
            </div>
            <PartySelect
              value={partyId}
              onChange={v => selectParty(String(v))}
              parties={parties as any[]}
              placeholder="Select party"
              hasError={!!errors.party}
            />
            {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
          </div>
          <div className="space-y-1"><Label>Order Date *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className={errors.date ? "border-destructive" : ""} /></div>
          <div className="space-y-1"><Label>Delivery Date</Label><Input type="date" min={date} value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={partyPhone} onChange={e => setPartyPhone(e.target.value)} placeholder="Auto-filled from party" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Delivery Address</Label><Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Auto-filled from party" /></div>
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
                <ItemSearchCombobox
                  stockItems={stockItems as any[]}
                  itemName={item.itemName}
                  stockItemId={item.stockItemId}
                  onNameChange={v => updateItem(i, "itemName", v)}
                  onItemSelect={si => selectStock(i, String(si.id))}
                  onClear={() => clearItem(i)}
                  onQuickAdd={() => { setQuickAddForIndex(i); setQuickAddOpen(true); }}
                  inputClassName="h-10"
                />
                <Input
                  className="h-8 text-sm"
                  placeholder="Description (optional)"
                  value={item.description || ""}
                  onChange={e => updateItem(i, "description", e.target.value)}
                />
                {item.stockItemId && stockAvail[item.stockItemId] && (
                  <p className="text-xs px-1 -mt-1">
                    <span className="text-muted-foreground">Phys: {stockAvail[item.stockItemId].physicalStock}</span>
                    {" · "}
                    <span className={stockAvail[item.stockItemId].availableStock < 0 ? "text-red-600 font-medium" : stockAvail[item.stockItemId].availableStock === 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
                      Avail: {stockAvail[item.stockItemId].availableStock}
                    </span>
                    {` ${item.unit}`}
                  </p>
                )}
                {item.stockItemId && item.quantity > 0 && (() => {
                  const selBatch = item.batchId ? (batches as any[]).find((b: any) => b.id === item.batchId) : null;
                  const effAvail = selBatch
                    ? Number(selBatch.physicalStock) - Number(selBatch.reservedStock)
                    : (stockAvail[item.stockItemId!]?.availableStock ?? null);
                  return effAvail != null && item.quantity > effAvail ? (
                    <p className="text-xs text-amber-700 flex items-center gap-1 px-1 mt-0.5">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Only {effAvail} {item.unit} available — order can still be saved
                    </p>
                  ) : null;
                })()}
                {item.stockItemId && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground shrink-0">Batch:</span>
                    <Select value={item.batchId ? String(item.batchId) : "none"} onValueChange={v => updateItem(i, "batchId", v === "none" ? undefined : Number(v))}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="— none —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— none —</SelectItem>
                        {(batches as any[]).filter((b: any) => !item.stockItemId || b.items?.some((bi: any) => bi.id === item.stockItemId)).map((b: any) => {
                          const avail = Number(b.physicalStock) - Number(b.reservedStock);
                          const isDefault = b.items?.some((bi: any) => bi.id === item.stockItemId);
                          return <SelectItem key={b.id} value={String(b.id)}>{b.name}{isDefault ? " (default)" : ""} · avail: {avail}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Qty</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} disabled={item.unit === "n/a"} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="0" /></div>
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
                    <div className="flex items-center justify-center bg-muted rounded-md border text-sm font-medium text-muted-foreground h-10">
      {item.gstInclusive ? "Inclusive" : "Exclusive"}
    </div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">GST%</Label>
                    <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Total</Label><div className="h-10 flex items-center justify-end font-bold text-base">{formatCurrency(item.total)}</div></div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" className="h-10 flex-1" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 18, gstInclusive: false })])}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
            </div>
            <div className="flex justify-between items-center font-bold text-base border-t pt-2">
              <span>Grand Total</span>
              <div className="flex items-center gap-2">

                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
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
                      <ItemSearchCombobox
                        stockItems={stockItems as any[]}
                        itemName={item.itemName}
                        stockItemId={item.stockItemId}
                        onNameChange={v => updateItem(i, "itemName", v)}
                        onItemSelect={si => selectStock(i, String(si.id))}
                        onClear={() => clearItem(i)}
                        onQuickAdd={() => { setQuickAddForIndex(i); setQuickAddOpen(true); }}
                      />
                      <Input
                        className="h-7 text-xs mt-1"
                        placeholder="Description (optional)"
                        value={item.description || ""}
                        onChange={e => updateItem(i, "description", e.target.value)}
                      />
                      {item.stockItemId && stockAvail[item.stockItemId] && (
                        <p className="text-xs mt-0.5 px-1">
                          <span className="text-muted-foreground">Phys: {stockAvail[item.stockItemId].physicalStock}</span>
                          {" · "}
                          <span className={stockAvail[item.stockItemId].availableStock < 0 ? "text-red-600 font-medium" : stockAvail[item.stockItemId].availableStock === 0 ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
                            Avail: {stockAvail[item.stockItemId].availableStock}
                          </span>
                          {` ${item.unit}`}
                        </p>
                      )}
                      {item.stockItemId && item.quantity > 0 && (() => {
                        const selBatch = item.batchId ? (batches as any[]).find((b: any) => b.id === item.batchId) : null;
                        const effAvail = selBatch
                          ? Number(selBatch.physicalStock) - Number(selBatch.reservedStock)
                          : (stockAvail[item.stockItemId!]?.availableStock ?? null);
                        return effAvail != null && item.quantity > effAvail ? (
                          <p className="text-xs text-amber-700 flex items-center gap-1 px-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Only {effAvail} {item.unit} available — order can still be saved
                          </p>
                        ) : null;
                      })()}
                      {item.stockItemId && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-muted-foreground shrink-0">Batch:</span>
                          <Select value={item.batchId ? String(item.batchId) : "none"} onValueChange={v => updateItem(i, "batchId", v === "none" ? undefined : Number(v))}>
                            <SelectTrigger className="h-6 text-xs py-0 flex-1 min-w-0"><SelectValue placeholder="— none —" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— none —</SelectItem>
                              {(batches as any[]).filter((b: any) => !item.stockItemId || b.items?.some((bi: any) => bi.id === item.stockItemId)).map((b: any) => {
                                const avail = Number(b.physicalStock) - Number(b.reservedStock);
                                const isDefault = b.items?.some((bi: any) => bi.id === item.stockItemId);
                                return <SelectItem key={b.id} value={String(b.id)}>{b.name}{isDefault ? " (default)" : ""} · {avail}</SelectItem>;
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </TableCell>
                    <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.quantity || ""} disabled={item.unit === "n/a"} onChange={e => updateItem(i, "quantity", e.target.value)} /></TableCell>
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
                        <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                    <TableCell><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 18, gstInclusive: false })])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
              <div className="font-bold">Total: {formatCurrency(grandTotal)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {(() => {
        const overItems = items.filter(item => {
          if (!item.stockItemId || !item.quantity) return false;
          const selBatch = item.batchId ? (batches as any[]).find((b: any) => b.id === item.batchId) : null;
          const effAvail = selBatch
            ? Number(selBatch.physicalStock) - Number(selBatch.reservedStock)
            : (stockAvail[item.stockItemId]?.availableStock ?? null);
          return effAvail != null && item.quantity > effAvail;
        });
        return overItems.length > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              <strong>Stock warning:</strong> {overItems.map(i => i.itemName || "item").join(", ")} {overItems.length === 1 ? "exceeds" : "exceed"} available stock.
              The order can still be saved — stock will go negative.
            </span>
          </div>
        ) : null;
      })()}
      <Card>
        <CardHeader><CardTitle className="text-base">Dispatch Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Driver Name</Label><Input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Optional" /></div>
          <div className="space-y-1"><Label>Vehicle Name</Label><Input value={vehicleName} onChange={e => setVehicleName(e.target.value)} placeholder="e.g. Tempo, Truck" /></div>
          <div className="space-y-1"><Label>Vehicle No.</Label><Input value={vehicleNo} onChange={e => setVehicleNo(e.target.value.toUpperCase())} placeholder="MH12AB1234" /></div>
          <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="General notes" /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Dispatch Notes</Label><Textarea value={dispatchNotes} onChange={e => setDispatchNotes(e.target.value)} placeholder="Special dispatch instructions..." rows={2} /></div>
        </CardContent>
      </Card>

      <QuickAddItemDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={handleQuickAdded} />
      <QuickAddPartyDialog
        open={showAddParty}
        onOpenChange={setShowAddParty}
        defaultAccountGroup="Sundry Debtors"
        onCreated={p => { setPartyId(p.id); setPartyName(p.name); setPartyPhone(p.phone || ""); setErrors(prev => { const n = { ...prev }; delete n.party; return n; }); }}
      />
    </form>
  );
}
