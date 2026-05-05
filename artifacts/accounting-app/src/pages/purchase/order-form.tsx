import { useState, useEffect } from "react";
import { useCreatePurchaseOrder, useGetPurchaseOrder, useListParties, useListStockItems, getListPurchaseOrdersQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface POItem {
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

function calcItem(item: Partial<POItem>): POItem {
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

export default function PurchaseOrderForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!(params?.id);
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreatePurchaseOrder();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});
  const { data: existing } = useGetPurchaseOrder(editId!, { query: { enabled: isEdit } });

  const [partyId, setPartyId] = useState<number | undefined>();
  const [partyName, setPartyName] = useState("");
  const [date, setDate] = useState(today());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18, gstInclusive: false })]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!existing || !isEdit) return;
    const o = existing as any;
    if (o.partyId) setPartyId(o.partyId);
    setPartyName(o.partyName || "");
    if (o.date) setDate(o.date);
    setDeliveryDate(o.deliveryDate || "");
    setNotes(o.notes || "");
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
    if (p) { setPartyId(p.id); setPartyName(p.name); setErrors(prev => { const n = { ...prev }; delete n.party; return n; }); }
  };

  const updateItem = (index: number, field: keyof POItem, value: any) => {
    setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], [field]: value }); return u; });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      const gstPct = si.gstApplicable === "true" ? Number(si.gstRate) || 0 : 0;
      setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], stockItemId: si.id, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.purchaseRate, gstPct, gstLocked: si.gstApplicable === "true" }); return u; });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!partyId) e.party = "Supplier is required";
    if (!date) e.date = "Date is required";
    if (items.length === 0) e.items = "At least one item is required";
    if (items.some(i => !i.itemName)) e.items = "All items must have a name";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const payload = { date, partyId, partyName, notes, deliveryDate: deliveryDate || undefined, grandTotal, items };
    try {
      if (isEdit) {
        await customFetch(`/api/purchase-orders/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast({ title: "Purchase order updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Purchase order created" });
      }
      queryClient.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
      setLocation("/purchase/orders");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/purchase/orders"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <h1 className="text-xl font-bold">{isEdit ? "Edit Purchase Order" : "New Purchase Order"}</h1>
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving..." : isEdit ? "Update PO" : "Save PO"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Supplier & Date</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Supplier *</Label>
            <Select value={partyId ? String(partyId) : ""} onValueChange={selectParty}>
              <SelectTrigger className={errors.party ? "border-destructive" : ""}><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{(parties as any[]).filter((p: any) => p.type === "supplier" || p.type === "both").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
          </div>
          <div className="space-y-1"><Label>PO Date *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Expected Delivery Date</Label><Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" /></div>
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
                <Select onValueChange={v => selectStock(i, v)}>
                  <SelectTrigger className="h-10 text-sm w-full"><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>{(stockItems as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                {!item.stockItemId && <Input className="h-10 text-sm" placeholder="Item name *" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />}
                {item.stockItemId && <div className="text-sm text-muted-foreground px-1 -mt-1">{item.itemName}</div>}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Qty</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="0" /></div>
                  <div className="space-y-1"><Label className="text-xs text-muted-foreground">Unit</Label>
                    {item.stockItemId ? (
                      <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>
                    ) : (
                      <Input className="h-10 text-base" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} />
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
            <Button type="button" variant="outline" className="w-full h-10" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18, gstInclusive: false })])}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
            <div className="font-bold text-right text-base">Total: {formatCurrency(grandTotal)}</div>
          </div>

          {/* Desktop table layout */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Disc%</TableHead>
                  <TableHead className="w-32">GST Type / %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select onValueChange={v => selectStock(i, v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>{(stockItems as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {!item.stockItemId && <Input className="h-7 mt-1 text-xs" placeholder="Item name" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />}
                      {item.stockItemId && <div className="text-xs text-muted-foreground mt-1 px-1">{item.itemName}</div>}
                    </TableCell>
                    <TableCell><Input className="h-7 text-xs" type="number" min="0" step="any" value={item.quantity || ""} onChange={e => updateItem(i, "quantity", e.target.value)} /></TableCell>
                    <TableCell>{item.stockItemId ? (
                      <div className="h-7 flex items-center gap-1 px-2 bg-muted rounded border text-xs text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>
                    ) : (
                      <Input className="h-7 text-xs" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} />
                    )}</TableCell>
                    <TableCell><Input className="h-7 text-xs" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-7 text-xs" type="number" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} /></TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex rounded overflow-hidden border text-xs font-medium">
                          <button type="button" onClick={() => updateItem(i, "gstInclusive", false)}
                            className={`flex-1 px-1 py-0.5 transition-colors ${!item.gstInclusive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>Ex</button>
                          <button type="button" onClick={() => updateItem(i, "gstInclusive", true)}
                            className={`flex-1 px-1 py-0.5 border-l transition-colors ${item.gstInclusive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>In</button>
                        </div>
                        {item.gstLocked ? (
                          <div className="h-7 flex items-center gap-1 px-2 bg-muted rounded border text-xs text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>
                        ) : (
                          <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                    <TableCell><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
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
    </form>
  );
}
