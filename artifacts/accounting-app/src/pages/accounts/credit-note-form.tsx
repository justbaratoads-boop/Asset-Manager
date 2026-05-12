import { useState, useEffect } from "react";
import { useCreateCreditNote, useGetCreditNote, useListParties, useListStockItems, getListCreditNotesQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { UnitSelect } from "@/components/unit-select";
import { useToast } from "@/hooks/use-toast";

interface NoteItem {
  stockItemId?: number;
  itemName: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPct: number;
  gstPct: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

function calcItem(item: Partial<NoteItem>, isInterstate: boolean): NoteItem {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const discPct = Number(item.discountPct) || 0;
  const gstPct = Number(item.gstPct) || 0;
  const taxable = qty * rate * (1 - discPct / 100);
  const gst = taxable * (gstPct / 100);
  return {
    stockItemId: item.stockItemId,
    itemName: item.itemName || "",
    hsnCode: item.hsnCode || "",
    quantity: qty, unit: item.unit || "pcs", rate,
    discountPct: discPct, gstPct,
    taxableAmount: taxable,
    cgst: isInterstate ? 0 : gst / 2,
    sgst: isInterstate ? 0 : gst / 2,
    igst: isInterstate ? gst : 0,
    total: taxable + gst,
  };
}

export default function CreditNoteForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!(params?.id);
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateCreditNote();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});
  const { data: existing } = useGetCreditNote(editId!, { query: { enabled: isEdit } });

  const [partyId, setPartyId] = useState<number | undefined>();
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [isInterstate, setIsInterstate] = useState(false);
  const [items, setItems] = useState<NoteItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 0 }, false)]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!existing || !isEdit) return;
    const n = existing as any;
    if (n.partyId) setPartyId(n.partyId);
    if (n.date) setDate(n.date);
    setReason(n.reason || "");
    const interstate = n.isInterstate === "true" || n.isInterstate === true;
    setIsInterstate(interstate);
    if (n.items?.length) {
      setItems(n.items.map((i: any) => calcItem({
        stockItemId: i.stockItemId,
        itemName: i.itemName,
        hsnCode: i.hsnCode || "",
        quantity: Number(i.quantity),
        unit: i.unit,
        rate: Number(i.rate),
        discountPct: Number(i.discountPct) || 0,
        gstPct: Number(i.gstPct) || 0,
      }, interstate)));
    }
  }, [existing]);

  const selectedParty = (parties as any[]).find((p: any) => p.id === partyId);

  const totals = {
    taxable: items.reduce((s, i) => s + i.taxableAmount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    grand: items.reduce((s, i) => s + i.total, 0),
  };

  const updateItem = (index: number, field: keyof NoteItem, value: any) => {
    setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], [field]: value }, isInterstate); return u; });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      const gstPct = si.gstApplicable === "true" ? Number(si.gstRate) || 0 : 0;
      setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], stockItemId: si.id, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.saleRate, gstPct }, isInterstate); return u; });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!partyId) e.party = "Party is required";
    if (!reason.trim()) e.reason = "Reason is required";
    if (items.length === 0) e.items = "Add at least one item";
    if (items.some(i => !i.itemName)) e.items = "All items must have a name";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const payload = {
      date, partyId, partyName: selectedParty?.name || "",
      reason, amount: totals.grand, items,
      totalTaxable: totals.taxable, totalCgst: totals.cgst,
      totalSgst: totals.sgst, totalIgst: totals.igst, isInterstate,
    };
    try {
      if (isEdit) {
        await customFetch(`/api/credit-notes/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Credit note updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Credit note created", description: "Stock has been updated (returned to inventory)" });
      }
      queryClient.invalidateQueries({ queryKey: getListCreditNotesQueryKey() });
      setLocation("/accounts/credit-notes");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/accounts/credit-notes"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Credit Note" : "New Credit Note"}</h1>
        <span className="text-sm text-muted-foreground">(Sale Return — stock increases)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Customer *</Label>
                <Select value={partyId ? String(partyId) : ""} onValueChange={v => { setPartyId(Number(v)); setErrors(p => { const n = { ...p }; delete n.party; return n; }); }}>
                  <SelectTrigger className={errors.party ? "border-destructive" : ""}><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{(parties as any[]).filter((p: any) => p.type === "customer" || p.type === "both").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Reason *</Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Goods returned by customer, quality issue..." rows={2} className={errors.reason ? "border-destructive" : ""} />
                {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
              </div>
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
                  <Select onValueChange={v => selectStock(i, v)}>
                    <SelectTrigger className="h-10 text-sm w-full"><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{(stockItems as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {!item.stockItemId && <Input className="h-10 text-sm" placeholder="Item name *" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />}
                  {item.stockItemId && <div className="text-sm text-muted-foreground px-1 -mt-1">{item.itemName}</div>}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <UnitSelect value={item.unit} onChange={v => updateItem(i, "unit", v)} className="h-10" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Rate</Label>
                      <Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">GST%</Label>
                      <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 col-span-2 flex items-end justify-end">
                      <div>
                        <Label className="text-xs text-muted-foreground">Total</Label>
                        <div className="h-10 flex items-center justify-end font-bold text-base">{formatCurrency(item.total)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full h-10" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 0 }, isInterstate)])}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
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
                    <TableHead>GST%</TableHead>
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
                      <TableCell><UnitSelect value={item.unit} onChange={v => updateItem(i, "unit", v)} className="h-7" /></TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                      <TableCell><Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select></TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                      <TableCell><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 0 }, isInterstate)])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span>{formatCurrency(totals.taxable)}</span></div>
            {totals.cgst > 0 && <><div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{formatCurrency(totals.cgst)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{formatCurrency(totals.sgst)}</span></div></>}
            {totals.igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{formatCurrency(totals.igst)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Credit Amount</span><span className="text-green-600">{formatCurrency(totals.grand)}</span></div>
            <p className="text-xs text-muted-foreground pt-1">Items will be added back to inventory on save.</p>
          </CardContent>
        </Card>
      </div>

      <div className="pt-2 border-t">
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Saving..." : isEdit ? "Update Credit Note" : "Save Credit Note"}
        </Button>
      </div>
    </form>
  );
}
