// @ts-nocheck
import { useState, useEffect } from "react";
import { useCreateCreditNote, useGetCreditNote, useListParties, useListStockItems, getListCreditNotesQueryKey, customFetch, useListLedgers } from "@workspace/api-client-react";
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
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Printer, Lock, AlertTriangle } from "lucide-react";
import { getGstRateForDate, computeInvoice } from "../../lib/gst";

import { UnitSelect } from "@/components/unit-select";
import { useToast } from "@/hooks/use-toast";
import { OtherChargesSection, type OtherCharge } from "@/components/other-charges-section";

interface NoteItem {
  stockItemId?: number;
  itemName: string;
  hsnCode: string;
  quantity: number | string;
  unit: string;
  rate: number | string;
  discountPct: number | string;
  gstPct: number | string;
  gstLocked: boolean;
  gstInclusive: boolean;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
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
  const gstInclusive = item.gstInclusive ?? false;
  
  const subtotal = qty * rate;
  const discountAmount = subtotal * (discPct / 100);
  const grossAmount = subtotal - discountAmount;
  
  const taxable = (gstInclusive && gstPct > 0) ? grossAmount / (1 + gstPct / 100) : grossAmount;
  const gstAmount = (gstInclusive && gstPct > 0) ? grossAmount - taxable : taxable * (gstPct / 100);
  
  const cgst = isInterstate ? 0 : gstAmount / 2;
  const sgst = isInterstate ? 0 : gstAmount / 2;
  const igst = isInterstate ? gstAmount : 0;
  const total = gstInclusive ? grossAmount : grossAmount + gstAmount;

  return {
    stockItemId: item.stockItemId,
    itemName: item.itemName || "",
    hsnCode: item.hsnCode || "",
    quantity: typeof item.quantity === 'string' && item.quantity.endsWith('.') ? item.quantity : qty,
    unit: item.unit || "pcs",
    rate: typeof item.rate === 'string' && item.rate.endsWith('.') ? item.rate : rate,
    discountPct: typeof item.discountPct === 'string' && item.discountPct.endsWith('.') ? item.discountPct : discPct,
    gstPct,
    gstLocked: item.gstLocked || false,
    gstInclusive,
    discountAmount,
    taxableAmount: taxable,
    gstAmount,
    cgst,
    sgst,
    igst,
    total,
  };
}

function GstToggle({ value }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="h-8 flex items-center justify-center bg-muted rounded border text-xs font-medium text-muted-foreground px-2">
      {value ? "In" : "Ex"}
    </div>
  );
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
  const stockAvail = useStockAvailability();
  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");
  const { data: existing } = useGetCreditNote(editId!, { query: { enabled: isEdit } });
  const { data: ledgers = [] } = useListLedgers();

  const [partyId, setPartyId] = useState<number | undefined>();
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [isInterstate, setIsInterstate] = useState(false);
  const [items, setItems] = useState<NoteItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 0, gstLocked: false, gstInclusive: false }, false)]);
  const [charges, setCharges] = useState<OtherCharge[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

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
        gstLocked: !!i.stockItemId, gstInclusive: false, }, interstate)));
    }
    if (n.otherCharges) {
      try { setCharges(JSON.parse(n.otherCharges)); } catch { setCharges([]); }
    }
  }, [existing]);

  const selectedParty = (parties as any[]).find((p: any) => p.id === partyId);

  useEffect(() => {
    if (selectedParty) {
      const interstate = selectedParty.isOutOfState === "true" || selectedParty.isOutOfState === true;
      setIsInterstate(interstate);
      setItems(prev => prev.map(it => calcItem(it, interstate)));
    }
  }, [partyId]);

  const totals = {
    taxable: items.reduce((s, i) => s + i.taxableAmount, 0),
    cgst: items.reduce((s, i) => s + i.cgst, 0),
    sgst: items.reduce((s, i) => s + i.sgst, 0),
    igst: items.reduce((s, i) => s + i.igst, 0),
    grand: items.reduce((s, i) => s + i.total, 0),
  };

  const chargesTotal = charges.reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0);
  const grandTotal = totals.grand + chargesTotal;

  const updateItem = (index: number, field: keyof NoteItem, value: any) => {
    setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], [field]: value }, isInterstate); return u; });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      const gstPct = si.gstApplicable === "true" || si.gstApplicable === true ? getGstRateForDate(si, date) : 0;
      setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], stockItemId: si.id, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.saleRate, gstPct, quantity: si.unit === "n/a" ? 1 : u[index].quantity, gstLocked: true }, isInterstate); return u; });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!partyId) e.party = "Party is required";
    if (items.length === 0) e.items = "Add at least one item";
    if (items.some(i => !i.itemName)) e.items = "All items must have a name";
    return e;
  };

  const handleSave = async (afterSave?: (note: any) => void) => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSaving(true);
    const payload = {
      date, partyId, partyName: selectedParty?.name || "",
      reason, amount: grandTotal, items,
      totalTaxable: totals.taxable, totalCgst: totals.cgst,
      totalSgst: totals.sgst, totalIgst: totals.igst, isInterstate,
      otherCharges: charges.length > 0 ? JSON.stringify(charges) : null,
    };
    try {
      let saved: any;
      if (isEdit) {
        saved = await customFetch(`/api/credit-notes/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Credit note updated" });
      } else {
        saved = await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Credit note created", description: "Stock has been updated (returned to inventory)" });
      }
      queryClient.invalidateQueries({ queryKey: getListCreditNotesQueryKey() });
      if (afterSave) afterSave(saved);
      else setLocation("/accounts/credit-notes");
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave();
  };

  const handleSaveAndPrint = async () => {
    await handleSave((saved: any) => {
      const id = saved?.id || editId;
      if (id) setLocation(`/accounts/credit-notes/${id}?print=1`);
      else setLocation("/accounts/credit-notes");
    });
  };

  const blankItem = () => calcItem({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 0, gstLocked: false, gstInclusive: false }, isInterstate);

  // Re-calculate GST rates if invoice date changes
  useEffect(() => {
    if (items.some(it => it.stockItemId)) {
      setItems(prev => prev.map(it => {
        if (!it.stockItemId) return it;
        const si = (stockItems as any[] || []).find(s => s.id === it.stockItemId);
        if (!si) return it;
        const gstPct = si.gstApplicable === "true" || si.gstApplicable === true ? getGstRateForDate(si, date) : 0;
        return calcItem({ ...it, gstPct }, isInterstate);
      }));
    }
  }, [date, stockItems, isInterstate]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Credit Note" : "New Credit Note"}</h1>
        <span className="text-sm text-muted-foreground">(Sale Return — stock increases)</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Customer *</Label>
                <PartySelect
                  value={partyId}
                  onChange={v => { setPartyId(v); setErrors(p => { const n = { ...p }; delete n.party; return n; }); }}
                  parties={parties as any[]}
                  placeholder="Select customer"
                  hasError={!!errors.party}
                />
                {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Goods returned by customer, quality issue..." rows={2} className={errors.reason ? "border-destructive" : ""} />
                {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
              </div>
            </div>

            {isInterstate && <div className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-2 rounded">Interstate customer — IGST will apply</div>}

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
                  {item.stockItemId && (() => {
                    const b = Array.isArray(batches) ? batches.find((bt: any) => bt.items?.some((bItem: any) => bItem.id === item.stockItemId)) : undefined;
                    if (!b) return null;
                    const avail = Number(b.physicalStock) - Number(b.reservedStock);
                    return (
                      <p className="text-xs px-1 text-sky-600 flex items-center gap-1">
                        <span className="font-medium">Batch: {b.name}</span>
                        <span className="text-muted-foreground">· avail: {avail}</span>
                      </p>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} disabled={item.unit === "n/a"} onChange={e => updateItem(i, "quantity", e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <UnitSelect value={item.unit} onChange={v => updateItem(i, "unit", v)} className="h-10" disabled={true} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Rate</Label>
                      <Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">GST% {item.gstLocked && <Lock className="h-3 w-3 text-muted-foreground" />}</Label>
                      <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)} disabled={item.gstLocked}>
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
              <Button type="button" variant="outline" className="w-full h-10" onClick={() => setItems(prev => [...prev, blankItem()])}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
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
                        {item.stockItemId && (() => {
                          const b = Array.isArray(batches) ? batches.find((bt: any) => bt.items?.some((bItem: any) => bItem.id === item.stockItemId)) : undefined;
                          if (!b) return null;
                          const avail = Number(b.physicalStock) - Number(b.reservedStock);
                          return (
                            <p className="text-xs mt-0.5 px-1 text-sky-600 flex items-center gap-1">
                              <span className="font-medium">Batch: {b.name}</span>
                              <span className="text-muted-foreground">· avail: {avail}</span>
                            </p>
                          );
                        })()}
                      </TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} disabled={item.unit === "n/a"} onChange={e => updateItem(i, "quantity", e.target.value)} /></TableCell>
                      <TableCell><UnitSelect value={item.unit} onChange={v => updateItem(i, "unit", v)} className="h-7" disabled={!!item.stockItemId && item.unit !== "n/a"} /></TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" inputMode="decimal" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)} disabled={item.gstLocked}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                          </Select>
                          {item.gstLocked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                      <TableCell><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setItems(prev => [...prev, blankItem()])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
            </div>

            {/* Other Charges */}
            <div className="border rounded-lg p-3 bg-muted/20">
              <OtherChargesSection charges={charges} onChange={setCharges} ledgers={ledgers as any[]} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span>{formatCurrency(totals.taxable)}</span></div>
            {totals.cgst > 0 && <><div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{formatCurrency(totals.cgst)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{formatCurrency(totals.sgst)}</span></div></>}
            {totals.igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{formatCurrency(totals.igst)}</span></div>}
            {chargesTotal !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">Other Charges</span><span className={chargesTotal < 0 ? "text-red-600" : ""}>{chargesTotal < 0 ? "− " : "+ "}{formatCurrency(Math.abs(chargesTotal))}</span></div>}
            <div className="flex justify-between items-center font-bold text-base border-t pt-2">
              <span>Credit Amount</span>
              <div className="flex items-center gap-2">
                {grandTotal % 1 !== 0 && grandTotal > 0 && (
                  <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] px-2 py-0" onClick={() => {
                    const rounded = Math.round(grandTotal);
                      const diff = rounded - grandTotal;
                      if (diff !== 0) {
                        setCharges(prev => [...prev, { name: "Round Off", amount: String(Math.abs(diff).toFixed(2)), type: diff > 0 ? "add" : "deduct" }]);
                      }
                    }}>Auto Round Off</Button>
                )}
                <span className="text-green-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Items will be added back to inventory on save.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 pt-2 border-t">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : isEdit ? "Update Credit Note" : "Save Credit Note"}
        </Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={handleSaveAndPrint} className="gap-2">
          <Printer className="h-4 w-4" />Save &amp; Print
        </Button>
      </div>
    </form>
  );
}
