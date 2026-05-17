import { useState, useEffect } from "react";
import { useCreateSaleInvoice, useGetSaleInvoice, useListParties, useListStockItems, getListSaleInvoicesQueryKey, getListStockItemsQueryKey } from "@workspace/api-client-react";
import { useStockAvailability } from "@/hooks/use-stock-availability";
import { useFetch } from "@/hooks/use-fetch";
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
import { Plus, Trash2, ArrowLeft, Printer, Send, Save, Lock, AlertTriangle } from "lucide-react";
import { ItemSearchCombobox } from "@/components/item-search-combobox";
import { UnitSelect } from "@/components/unit-select";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";
import { QuickAddPartyDialog } from "@/components/quick-add-party-dialog";
import { QuickAddItemDialog } from "@/components/quick-add-item-dialog";
import { OtherChargesSection, type OtherCharge } from "@/components/other-charges-section";
import { PartySelect } from "@/components/party-select";

interface InvoiceItem {
  stockItemId?: number;
  batchId?: number;
  itemName: string;
  description?: string;
  hsnCode: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPct: number;
  gstPct: number;
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

function calcItem(item: Partial<InvoiceItem>, isInterstate: boolean): InvoiceItem {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const discPct = Number(item.discountPct) || 0;
  const gstPct = Number(item.gstPct) || 0;
  const gstInclusive = item.gstInclusive ?? false;
  const subtotal = qty * rate;
  // Actual user-entered discount only
  const discountAmount = subtotal * (discPct / 100);
  const grossAmount = subtotal - discountAmount;
  // Inclusive: rate already contains GST — extract base and GST from grossAmount
  // Exclusive: grossAmount is the base, GST is added on top
  const taxable = (gstInclusive && gstPct > 0) ? grossAmount / (1 + gstPct / 100) : grossAmount;
  const gstAmount = (gstInclusive && gstPct > 0) ? grossAmount - taxable : taxable * (gstPct / 100);
  const cgst = isInterstate ? 0 : gstAmount / 2;
  const sgst = isInterstate ? 0 : gstAmount / 2;
  const igst = isInterstate ? gstAmount : 0;
  // Inclusive total = grossAmount (GST already inside); Exclusive total = grossAmount + GST
  const total = gstInclusive ? grossAmount : grossAmount + gstAmount;
  return {
    stockItemId: item.stockItemId,
    batchId: item.batchId,
    itemName: item.itemName || "",
    description: item.description || "",
    hsnCode: item.hsnCode || "",
    quantity: qty,
    unit: item.unit || "pcs",
    rate,
    discountPct: discPct,
    gstPct,
    gstLocked: item.gstLocked ?? false,
    gstInclusive,
    discountAmount,
    taxableAmount: taxable,
    gstAmount,
    cgst, sgst, igst,
    total,
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


const BASE_PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
];

export default function SaleInvoiceForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!(params?.id);
  const editId = isEdit ? Number(params.id) : undefined;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSaleInvoice();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});
  const stockAvail = useStockAvailability();
  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");
  const { data: existing } = useGetSaleInvoice(editId!, { query: { enabled: isEdit } });

  const fromOrderId = new URLSearchParams(window.location.search).get("fromOrder");

  const [billType, setBillType] = useState<"credit" | "cash">("credit");
  const [partyId, setPartyId] = useState<number | undefined>();
  const [showAddParty, setShowAddParty] = useState(false);
  const [manualName, setManualName] = useState("");
  const [date, setDate] = useState(today());
  const [isInterstate, setIsInterstate] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 0, gstInclusive: false }, false)]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForIndex, setQuickAddForIndex] = useState<number | null>(null);

  const [charges, setCharges] = useState<OtherCharge[]>([]);
  const [payRows, setPayRows] = useState<{ mode: string; amount: string; reference: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<{ value: string; label: string }[]>([]);
  const [indirectLedgers, setIndirectLedgers] = useState<{ id: number; name: string; group: string }[]>([]);

  useEffect(() => {
    customFetch<any>("/api/ledgers?group=Bank%20Accounts").then((data: any) => {
      if (Array.isArray(data)) setBankAccounts(data.map((l: any) => ({ value: `bank_${l.id}`, label: l.name })));
    }).catch(() => {});
    Promise.all([
      customFetch<any>("/api/ledgers?group=Indirect%20Expenses"),
      customFetch<any>("/api/ledgers?group=Indirect%20Incomes"),
    ]).then(([exp, inc]) => {
      setIndirectLedgers([
        ...(Array.isArray(exp) ? exp : []),
        ...(Array.isArray(inc) ? inc : []),
      ].sort((a: any, b: any) => a.name.localeCompare(b.name)));
    }).catch(() => {});
  }, []);

  const allPaymentModes = [...BASE_PAYMENT_MODES, ...bankAccounts];

  const selectedParty = (parties as any[]).find((p: any) => p.id === partyId);

  const totals = items.reduce((acc, item) => ({
    subtotal: acc.subtotal + item.quantity * item.rate,
    discount: acc.discount + item.discountAmount,
    taxable: acc.taxable + item.taxableAmount,
    gst: acc.gst + item.gstAmount,
    cgst: acc.cgst + item.cgst,
    sgst: acc.sgst + item.sgst,
    igst: acc.igst + item.igst,
    grand: acc.grand + item.total,
  }), { subtotal: 0, discount: 0, taxable: 0, gst: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 });

  const chargesTotal = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const grandTotal = totals.grand + chargesTotal;

  const amountPaid = payRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const balanceDue = grandTotal - amountPaid;

  const updatePayRow = (i: number, field: string, value: string) => {
    setPayRows(prev => { const u = [...prev]; u[i] = { ...u[i], [field]: value }; return u; });
  };

  const handleBillTypeChange = (type: "credit" | "cash") => {
    setBillType(type);
    if (type === "cash") {
      setPayRows([{ mode: "cash", amount: grandTotal > 0 ? String(grandTotal.toFixed(2)) : "", reference: "" }]);
    } else {
      setPayRows([]);
    }
  };

  useEffect(() => {
    if (selectedParty) {
      const interstate = selectedParty.isOutOfState === "true" || selectedParty.isOutOfState === true;
      setIsInterstate(interstate);
      setItems(prev => prev.map(item => calcItem(item, interstate)));
    }
  }, [partyId]);

  useEffect(() => {
    if (!existing || !isEdit) return;
    const inv = existing as any;
    if (inv.partyId) { setPartyId(inv.partyId); setBillType("credit"); }
    else { setBillType("cash"); }
    if (inv.date) setDate(inv.date);
    const interstate = inv.isInterstate === "true" || inv.isInterstate === true;
    setIsInterstate(interstate);
    setNotes(inv.notes || "");
    if (inv.payments?.length) {
      setPayRows(inv.payments.map((p: any) => ({ mode: p.mode || "cash", amount: String(p.amount || ""), reference: p.reference || "" })));
    } else {
      setPayRows([]);
    }
    if (inv.otherCharges) {
      try { setCharges(JSON.parse(inv.otherCharges)); } catch { setCharges([]); }
    }
    if (inv.items?.length) {
      setItems(inv.items.map((i: any) => calcItem({
        stockItemId: i.stockItemId, batchId: i.batchId || undefined, itemName: i.itemName, description: i.description || "", hsnCode: i.hsnCode || "",
        quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate),
        discountPct: Number(i.discountPct) || 0, gstPct: Number(i.gstPct) || 0,
        gstLocked: !!i.stockItemId, gstInclusive: false,
      }, interstate)));
    }
  }, [existing]);

  useEffect(() => {
    if (!fromOrderId) return;
    customFetch<any>(`/api/orders/${fromOrderId}`).then(order => {
      if (order.partyId) setPartyId(order.partyId);
      if (order.date) setDate(order.date);
      if (order.notes) setNotes(order.notes);
      if (order.items?.length) {
        setItems(order.items.map((i: any) => calcItem({
          stockItemId: i.stockItemId, batchId: i.batchId || undefined, itemName: i.itemName, description: i.description || "", hsnCode: i.hsnCode || "",
          quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate),
          discountPct: Number(i.discountPct) || 0, gstPct: Number(i.gstPct) || 0,
          gstLocked: !!i.stockItemId, gstInclusive: false,
        }, false)));
      }
    }).catch(() => {});
  }, [fromOrderId]);

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = calcItem({ ...updated[index], [field]: value }, isInterstate);
      return updated;
    });
  };

  const selectStockItem = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      const gstPct = si.gstApplicable === "true" ? Number(si.gstRate) || 0 : 0;
      setItems(prev => {
        const updated = [...prev];
        updated[index] = calcItem({ ...updated[index], stockItemId: si.id, batchId: si.batchId ? Number(si.batchId) : undefined, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.saleRate, gstPct, quantity: si.unit === "n/a" ? 1 : updated[index].quantity, gstLocked: true }, isInterstate);
        return updated;
      });
    }
  };

  const clearItem = (index: number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = calcItem({ ...updated[index], stockItemId: undefined, batchId: undefined, gstLocked: false }, isInterstate);
      return updated;
    });
  };

  const handleQuickAdded = (newItem: any) => {
    queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
    if (quickAddForIndex !== null) {
      const gstPct = newItem.gstApplicable === "true" ? Number(newItem.gstRate) || 0 : 0;
      setItems(prev => {
        const updated = [...prev];
        updated[quickAddForIndex] = calcItem({ ...updated[quickAddForIndex], stockItemId: newItem.id, batchId: newItem.batchId ? Number(newItem.batchId) : undefined, itemName: newItem.name, unit: newItem.unit, rate: newItem.saleRate, gstPct, quantity: newItem.unit === "n/a" ? 1 : updated[quickAddForIndex].quantity, gstLocked: true }, isInterstate);
        return updated;
      });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (billType === "credit" && !partyId) e.party = "Party is required for credit invoices";
    if (!date) e.date = "Date is required";
    for (let i = 0; i < items.length; i++) {
      if (!items[i].itemName) { e.items = `Row ${i + 1}: Item name is required`; break; }
      if (!items[i].quantity || items[i].quantity <= 0) { e.items = `Row ${i + 1}: Quantity must be > 0`; break; }
      if (!items[i].rate || items[i].rate <= 0) { e.items = `Row ${i + 1}: Rate must be > 0`; break; }
    }
    if (items.length === 0) e.items = "Add at least one item";
    if (amountPaid > grandTotal + 0.01) e.payment = `Total payments (${formatCurrency(amountPaid)}) cannot exceed invoice total (${formatCurrency(grandTotal)})`;
    return e;
  };

  const buildPayload = () => {
    const partyName = billType === "credit" ? (selectedParty?.name || "") : (manualName || "Cash Sale");
    const payments = payRows.filter(r => Number(r.amount) > 0).map(r => ({ mode: r.mode, amount: Number(r.amount), reference: r.reference }));
    return {
      date,
      partyId: billType === "credit" ? partyId : undefined,
      partyName,
      partyGstin: selectedParty?.gstin,
      billingAddress: selectedParty ? [selectedParty.city, selectedParty.state].filter(Boolean).join(", ") : "",
      isGst: items.some(i => i.gstPct > 0),
      isInterstate,
      subtotal: totals.subtotal,
      totalDiscount: totals.discount,
      totalTaxable: totals.taxable,
      totalCgst: totals.cgst,
      totalSgst: totals.sgst,
      totalIgst: totals.igst,
      totalGst: totals.cgst + totals.sgst + totals.igst,
      grandTotal,
      amountPaid,
      balanceDue,
      notes,
      items,
      payments,
      otherCharges: charges.length > 0 ? JSON.stringify(charges) : null,
      fromOrderId: fromOrderId ? Number(fromOrderId) : undefined,
    };
  };

  const handleSave = async (then?: (inv: any) => void) => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSaving(true);
    try {
      let inv: any;
      if (isEdit) {
        inv = await customFetch(`/api/sale-invoices/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        toast({ title: "Invoice updated successfully" });
      } else {
        inv = await createMutation.mutateAsync({ data: buildPayload() as any });
        toast({ title: "Invoice created successfully" });
      }
      queryClient.invalidateQueries({ queryKey: getListSaleInvoicesQueryKey() });
      if (then) then(inv);
      else setLocation("/sales/invoices");
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to save invoice";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); handleSave(); };
  const handleSaveAndPrint = () => handleSave((inv: any) => { const id = inv?.id || inv?.invoiceId; if (id) setLocation(`/sales/invoices/${id}?print=1`); else setLocation("/sales/invoices"); });
  const handleSaveAndSend = () => { toast({ title: "WhatsApp sharing coming soon" }); handleSave(); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/sales/invoices"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Sale Invoice" : fromOrderId ? "New Invoice (from Order)" : "New Sale Invoice"}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-4">
            {/* Bill Type */}
            <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg">
              <span className="text-sm font-medium">Bill Type:</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleBillTypeChange("credit")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${billType === "credit" ? "bg-primary text-primary-foreground" : "bg-background border"}`}>Credit</button>
                <button type="button" onClick={() => handleBillTypeChange("cash")} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${billType === "cash" ? "bg-primary text-primary-foreground" : "bg-background border"}`}>Cash</button>
              </div>
            </div>

            {/* Party + Date */}
            <div className="grid grid-cols-2 gap-4">
              {billType === "credit" ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Party *</Label>
                    <button type="button" onClick={() => setShowAddParty(true)} className="text-xs text-primary hover:underline font-medium">+ Add Party</button>
                  </div>
                  <PartySelect
                    value={partyId}
                    onChange={v => { setPartyId(v); setErrors(p => { const n = { ...p }; delete n.party; return n; }); }}
                    parties={(parties as any[]).filter((p: any) => p.type === "customer")}
                    placeholder="Select party"
                    hasError={!!errors.party}
                  />
                  {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Customer Name (optional)</Label>
                  <Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. Walk-in Customer" />
                </div>
              )}
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className={errors.date ? "border-destructive" : ""} />
              </div>
            </div>

            {selectedParty && (
              <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded">
                {selectedParty.gstin && <span className="mr-4">GSTIN: {selectedParty.gstin}</span>}
                {selectedParty.isOutOfState === "true" && <span className="text-amber-600 font-medium">Interstate (IGST applies)</span>}
                {selectedParty.phone && <span className="ml-4">Ph: {selectedParty.phone}</span>}
              </div>
            )}

            {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}

            {/* Mobile card layout */}
            <div className="md:hidden space-y-3">
              {items.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3 bg-card shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">Item {index + 1}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => setItems(prev => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <ItemSearchCombobox
                    stockItems={stockItems as any[]}
                    itemName={item.itemName}
                    stockItemId={item.stockItemId}
                    onNameChange={v => updateItem(index, "itemName", v)}
                    onItemSelect={si => selectStockItem(index, String(si.id))}
                    onClear={() => clearItem(index)}
                    onQuickAdd={() => { setQuickAddForIndex(index); setQuickAddOpen(true); }}
                    placeholder="Search item…"
                    inputClassName="h-10"
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
                  {item.stockItemId && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground shrink-0">Batch:</span>
                      <Select value={item.batchId ? String(item.batchId) : "none"} onValueChange={v => updateItem(index, "batchId", v === "none" ? undefined : Number(v))}>
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
                  <Input
                    className="h-8 text-sm"
                    placeholder="Description (optional)"
                    value={item.description || ""}
                    onChange={e => updateItem(index, "description", e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">Qty *</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0.001" step="any" value={item.quantity || ""} disabled={item.unit === "n/a"} onChange={e => updateItem(index, "quantity", e.target.value)} placeholder="0" /></div>
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">Unit</Label>
                      {item.stockItemId ? (
                        <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>
                      ) : (
                        <UnitSelect value={item.unit} onChange={v => updateItem(index, "unit", v)} className="h-10" />
                      )}
                    </div>
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">Rate *</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(index, "rate", e.target.value)} placeholder="0.00" /></div>
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">Disc%</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(index, "discountPct", e.target.value)} placeholder="0" /></div>
                    {/* GST Type + Rate */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">GST Type</Label>
                      <div className="flex rounded-md overflow-hidden border text-sm font-medium h-10">
                        <button type="button" onClick={() => updateItem(index, "gstInclusive", false)}
                          className={`flex-1 transition-colors ${!item.gstInclusive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                          Excl.
                        </button>
                        <button type="button" onClick={() => updateItem(index, "gstInclusive", true)}
                          className={`flex-1 border-l transition-colors ${item.gstInclusive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>
                          Incl.
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">GST%</Label>
                      <div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground">
                        <Lock className="h-3 w-3 shrink-0" />{item.gstPct}%
                      </div>
                    </div>
                  </div>

                  {/* Inclusive GST breakdown — always visible when inclusive and has values */}
                  {item.quantity > 0 && item.rate > 0 && item.gstInclusive && item.gstPct > 0 && (
                    <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold text-amber-800 mb-1">GST Inclusive Breakdown</p>
                      <div className="flex justify-between text-amber-900">
                        <span>Rate entered (incl. {item.gstPct}% GST)</span>
                        <span className="font-medium">{formatCurrency(item.rate)} × {item.quantity}</span>
                      </div>
                      <div className="flex justify-between text-green-800 font-medium">
                        <span>Cost Price (base)</span>
                        <span>{formatCurrency(item.taxableAmount)}</span>
                      </div>
                      <div className="flex justify-between text-blue-800 font-medium">
                        <span>GST ({item.gstPct}%)</span>
                        <span>+ {formatCurrency(item.gstAmount)}</span>
                      </div>
                      {item.discountAmount > 0 && (
                        <div className="flex justify-between text-red-700">
                          <span>Discount ({item.discountPct}%)</span>
                          <span>− {formatCurrency(item.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold border-t border-amber-200 pt-1 mt-0.5 text-amber-900">
                        <span>Item Total</span>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  )}

                  {/* Standard breakdown for exclusive GST */}
                  {item.quantity > 0 && item.rate > 0 && (!item.gstInclusive || item.gstPct === 0) && (
                    <div className="mt-1 rounded-md bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Base amount</span>
                        <span>{formatCurrency(item.taxableAmount)}</span>
                      </div>
                      {item.gstPct > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>GST ({item.gstPct}%)</span>
                          <span>+ {formatCurrency(item.gstAmount)}</span>
                        </div>
                      )}
                      {item.discountAmount > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Discount ({item.discountPct}%)</span>
                          <span>− {formatCurrency(item.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold border-t border-border/60 pt-1 mt-1">
                        <span>Total</span>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full h-10" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 0, gstInclusive: false }, isInterstate)])}>
                <Plus className="h-4 w-4 mr-2" />Add Item
              </Button>
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Item</TableHead>
                    <TableHead className="w-24">Qty *</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="w-28">Rate *</TableHead>
                    <TableHead className="w-20">Disc%</TableHead>
                    <TableHead className="w-32">GST Type / %</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <ItemSearchCombobox
                          stockItems={stockItems as any[]}
                          itemName={item.itemName}
                          stockItemId={item.stockItemId}
                          onNameChange={v => updateItem(index, "itemName", v)}
                          onItemSelect={si => selectStockItem(index, String(si.id))}
                          onClear={() => clearItem(index)}
                          onQuickAdd={() => { setQuickAddForIndex(index); setQuickAddOpen(true); }}
                          placeholder="Search item…"
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
                        {item.stockItemId && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs text-muted-foreground shrink-0">Batch:</span>
                            <Select value={item.batchId ? String(item.batchId) : "none"} onValueChange={v => updateItem(index, "batchId", v === "none" ? undefined : Number(v))}>
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
                        <Input
                          className="h-7 text-xs mt-1"
                          placeholder="Description (optional)"
                          value={item.description || ""}
                          onChange={e => updateItem(index, "description", e.target.value)}
                        />
                      </TableCell>
                      <TableCell><Input className="h-9 text-sm" type="number" min="0.001" step="any" value={item.quantity || ""} disabled={item.unit === "n/a"} onChange={e => updateItem(index, "quantity", e.target.value)} placeholder="Qty" /></TableCell>
                      <TableCell>{item.stockItemId ? (
                        <div className="h-9 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>
                      ) : (
                        <UnitSelect value={item.unit} onChange={v => updateItem(index, "unit", v)} className="h-9" />
                      )}</TableCell>
                      <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(index, "rate", e.target.value)} placeholder="Rate" /></TableCell>
                      <TableCell><Input className="h-9 text-sm" type="number" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(index, "discountPct", e.target.value)} placeholder="0" /></TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <GstToggle value={item.gstInclusive} onChange={v => updateItem(index, "gstInclusive", v)} />
                          <div className="h-8 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground">
                            <Lock className="h-3 w-3 shrink-0" />{item.gstPct}%
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity > 0 && item.rate > 0 ? (
                          item.gstInclusive && item.gstPct > 0 ? (
                            <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs space-y-0.5 text-left min-w-[130px]">
                              <div className="flex justify-between text-green-800 font-medium">
                                <span>Base</span>
                                <span>{formatCurrency(item.taxableAmount)}</span>
                              </div>
                              <div className="flex justify-between text-blue-800 font-medium">
                                <span>GST {item.gstPct}%</span>
                                <span>+{formatCurrency(item.gstAmount)}</span>
                              </div>
                              {item.discountAmount > 0 && (
                                <div className="flex justify-between text-red-700">
                                  <span>Disc.</span>
                                  <span>−{formatCurrency(item.discountAmount)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold border-t border-amber-200 pt-0.5 text-amber-900 text-sm">
                                <span>Total</span>
                                <span>{formatCurrency(item.total)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5 text-xs leading-tight">
                              <div className="text-muted-foreground">{formatCurrency(item.taxableAmount)} base</div>
                              {item.gstPct > 0 && <div className="text-muted-foreground">+{formatCurrency(item.gstAmount)} GST</div>}
                              {item.discountAmount > 0 && <div className="text-red-600">−{formatCurrency(item.discountAmount)} disc.</div>}
                              <div className="font-bold text-sm text-foreground border-t pt-0.5">{formatCurrency(item.total)}</div>
                            </div>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 0, gstInclusive: false }, isInterstate)])}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Item
              </Button>
            </div>

            <div className="border rounded-lg p-3 bg-muted/20">
              <OtherChargesSection charges={charges} onChange={setCharges} ledgers={indirectLedgers} />
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Right: totals + payment */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Totals</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (at rate)</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {totals.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>− {formatCurrency(totals.discount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Taxable (base)</span><span>{formatCurrency(totals.taxable)}</span></div>
              {!isInterstate && totals.cgst > 0 && <>
                <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>+ {formatCurrency(totals.cgst)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>+ {formatCurrency(totals.sgst)}</span></div>
              </>}
              {isInterstate && totals.igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>+ {formatCurrency(totals.igst)}</span></div>}
              {totals.gst === 0 && <div className="flex justify-between text-muted-foreground/60 text-xs"><span>GST</span><span>Nil</span></div>}
              {chargesTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>Additional Fields</span><span>+ {formatCurrency(chargesTotal)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span>{formatCurrency(grandTotal)}</span></div>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-primary">Payment Entry</CardTitle></CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 pt-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Add one or more payment rows</span>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => setPayRows(p => [...p, { mode: "cash", amount: "", reference: "" }])}>
                  <Plus className="h-3.5 w-3.5" />Add Payment
                </Button>
              </div>
              {payRows.length === 0 && (
                <p className="text-xs text-muted-foreground py-1 italic">No payment recorded — balance will be due.</p>
              )}
              {payRows.map((row, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <Select value={row.mode} onValueChange={v => updatePayRow(i, "mode", v)}>
                    <SelectTrigger className="h-8 text-xs w-[120px] shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>{allPaymentModes.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="relative flex-1 min-w-[80px]">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                    <Input className="pl-5 h-8 text-sm" type="number" inputMode="decimal" min="0" step="any"
                      value={row.amount}
                      onChange={e => { updatePayRow(i, "amount", e.target.value); setErrors(p => { const n = { ...p }; delete n.payment; return n; }); }}
                      placeholder="0.00" />
                  </div>
                  <Input className="h-8 text-xs flex-1 min-w-[72px]" placeholder="Ref / UTR" value={row.reference}
                    onChange={e => updatePayRow(i, "reference", e.target.value)} />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0"
                    onClick={() => setPayRows(p => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {errors.payment && <p className="text-xs text-destructive">{errors.payment}</p>}
              <div className="border-t pt-2 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span className="font-semibold text-green-600">{formatCurrency(amountPaid)}</span></div>
                <div className="flex justify-between font-bold"><span>Balance Due</span><span className={balanceDue > 0 ? "text-red-600" : "text-green-600"}>{formatCurrency(balanceDue)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2 border-t">
        <Button type="submit" disabled={isSaving} className="gap-2"><Save className="h-4 w-4" />{isSaving ? "Saving..." : "Save Invoice"}</Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={handleSaveAndPrint} className="gap-2"><Printer className="h-4 w-4" />Save &amp; Print</Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={handleSaveAndSend} className="gap-2"><Send className="h-4 w-4" />Save &amp; Send</Button>
      </div>

      <QuickAddItemDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={handleQuickAdded} />
      <QuickAddPartyDialog
        open={showAddParty}
        onOpenChange={setShowAddParty}
        defaultAccountGroup="Sundry Debtors"
        onCreated={p => { setPartyId(p.id); setErrors(prev => { const n = { ...prev }; delete n.party; return n; }); }}
      />
    </form>
  );
}
