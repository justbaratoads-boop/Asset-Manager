// @ts-nocheck
import { useState, useEffect, useRef, useMemo } from "react";
import { useCreatePurchaseInvoice, useGetPurchaseInvoice, useListParties, useListStockItems, getListPurchaseInvoicesQueryKey, getListStockItemsQueryKey, customFetch, useGetCompanySettings, getGetPurchaseInvoiceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStockAvailability } from "@/hooks/use-stock-availability";
import { useFetch } from "@/hooks/use-fetch";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartySelect } from "@/components/party-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Lock, Save, AlertTriangle } from "lucide-react";
import { getGstRateForDate, computeInvoice } from "../../lib/gst";
import { validateDecimalInput } from "@/lib/utils";

import { ItemSearchCombobox } from "@/components/item-search-combobox";
import { QuickAddPartyDialog } from "@/components/quick-add-party-dialog";
import { QuickAddItemDialog } from "@/components/quick-add-item-dialog";
import { OtherChargesSection, type OtherCharge } from "@/components/other-charges-section";
import { UnitSelect } from "@/components/unit-select";
import { useToast } from "@/hooks/use-toast";

interface Item {
  stockItemId?: number;
  batchId?: number;
  itemName: string;
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
  isTaxLiability?: boolean;
    isDecimalApplicable?: boolean;
    decimalPlaces?: number;
}

const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
];

function calc(item: Partial<Item>, isInterstate: boolean): Item {
  const qty = Number(item.quantity) || 0; const rate = Number(item.rate) || 0;
  const discPct = Number(item.discountPct) || 0; const gstPct = Number(item.gstPct) || 0;
  const gstInclusive = item.gstInclusive ?? false;
  const baseRate = (gstInclusive && gstPct > 0) ? Number((rate / (1 + gstPct / 100)).toFixed(2)) : rate;
  const subtotal = qty * baseRate;
  const discountAmount = subtotal * (discPct / 100);
  const taxable = subtotal - discountAmount;
  const gstAmount = taxable * (gstPct / 100);
  const total = taxable + gstAmount;
  return { itemName: item.itemName || "", hsnCode: item.hsnCode || "", quantity: qty, unit: item.unit || "pcs", rate, discountPct: discPct, discountAmount, gstPct, gstLocked: item.gstLocked ?? false, gstInclusive, taxableAmount: taxable, gstAmount, cgst: isInterstate ? 0 : gstAmount / 2, sgst: isInterstate ? 0 : gstAmount / 2, igst: isInterstate ? gstAmount : 0, total, stockItemId: item.stockItemId, batchId: item.batchId, isTaxLiability: item.isTaxLiability, isDecimalApplicable: item.isDecimalApplicable ?? true, decimalPlaces: item.decimalPlaces ?? 2 };
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
  const stockAvail = useStockAvailability();
  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");
  const { data: existing } = useGetPurchaseInvoice(editId!, { query: { enabled: isEdit } });
  const { data: companySettings } = useGetCompanySettings();
  const enableDualLedger = (companySettings as any)?.enableDualLedger ?? false;
  const autoRoundOff = (companySettings as any)?.autoRoundOff ?? false;
  const filteredStockItems = useMemo(() => {
    if (!stockItems) return [];
    if (enableDualLedger) return stockItems as any[];
    return (stockItems as any[]).filter(s => s.isTaxLiability !== false && String(s.isTaxLiability) !== "false");
  }, [stockItems, enableDualLedger]);

  const [partyId, setPartyId] = useState<number | undefined>();
  const [date, setDate] = useState(today());
  const [supplierInvNumber, setSupplierInvNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([calc({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 18, gstInclusive: false }, false)]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showAddParty, setShowAddParty] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForIndex, setQuickAddForIndex] = useState<number | null>(null);

  const [charges, setCharges] = useState<OtherCharge[]>([]);
  const [kacchaCharges, setKacchaCharges] = useState<OtherCharge[]>([]);
  const [payRows, setPayRows] = useState<{ mode: string; amount: string; reference: string }[]>([]);
  const [kacchaPayRows, setKacchaPayRows] = useState<{ mode: string; amount: string; reference: string }[]>([]);
  const [indirectLedgers, setIndirectLedgers] = useState<{ id: number; name: string; group: string }[]>([]);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    customFetch<any>("/api/ledgers").then((data: any) => {
      if (Array.isArray(data)) {
        const filtered = data.filter((l: any) => {
          const g = (l.group || "").toLowerCase();
          return g.includes("expense") || g.includes("income");
        });
        setIndirectLedgers(filtered.sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }
    }).catch(() => {});
  }, []);

  const selectedParty = (parties as any[]).find((p: any) => p.id === partyId);
  const isInterstate = selectedParty?.isOutOfState === "true" || selectedParty?.isOutOfState === true;
  const enableDiscount = (companySettings as any)?.enableDiscount ?? false;

  const enrichedCharges = charges.map(c => {
    const ledger = indirectLedgers.find(l => l.id === c.ledgerId);
    return {
      ...c,
      gstCalculationMethod: ledger?.gstCalculationMethod || c.gstCalculationMethod || "none",
      gstRate: ledger?.gstRate !== undefined && ledger?.gstRate !== null ? Number(ledger.gstRate) : (c.gstRate || 0)
    };
  });

  const { items: computedItems, totals: cTotals } = computeInvoice(items.map(i => ({ ...i, isTaxLiability: enableDualLedger ? i.isTaxLiability : true })), enrichedCharges, isInterstate, enableDualLedger ? !items.some(i => i.isTaxLiability) : false);
  const totals = { ...cTotals, grand: cTotals.grand - cTotals.chargesTotal };

  const chargesTotal = charges.reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0);
  const kacchaChargesTotal = kacchaCharges.reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0);
  const grandTotal = totals.grand + chargesTotal;

  const hasPakka = computedItems.some(i => enableDualLedger ? i.isTaxLiability : true);
  const hasKaccha = computedItems.some(i => !i.isTaxLiability);
  const rawKacchaSubtotal = computedItems.filter(i => enableDualLedger && !i.isTaxLiability).reduce((acc, item) => acc + item.total, 0);
  const kacchaGrandTotal = rawKacchaSubtotal + (!hasPakka ? chargesTotal : 0) + kacchaChargesTotal;

  const amountPaid = payRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const kacchaAmountPaid = kacchaPayRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  
  const balanceDue = grandTotal - amountPaid;
  const kacchaBalanceDue = kacchaGrandTotal - kacchaAmountPaid;

  const updatePayRow = (i: number, field: string, value: string) => {
    setPayRows(prev => { const u = [...prev]; u[i] = { ...u[i], [field]: value }; return u; });
  };

  const updateKacchaPayRow = (i: number, field: string, value: string) => {
    setKacchaPayRows(prev => { const u = [...prev]; u[i] = { ...u[i], [field]: value }; return u; });
  };

  useEffect(() => {
    if (!existing || !isEdit || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const inv = existing as any;
    if (inv.otherCharges) {
      try { setCharges(JSON.parse(inv.otherCharges)); } catch { setCharges([]); }
    }
    if (inv.partyId) setPartyId(inv.partyId);
    if (inv.date) setDate(inv.date);
    setSupplierInvNumber(inv.supplierInvoiceNumber || "");
    setNotes(inv.notes || "");
    const interstate = inv.isInterstate === "true" || inv.isInterstate === true;
    if (inv.payments?.length) {
      setPayRows(inv.payments.map((p: any) => ({ mode: p.mode || "cash", amount: String(p.amount || ""), reference: p.reference || "" })));
    } else {
      setPayRows([]);
    }
    if (inv.kacchaPayments?.length) {
      setKacchaPayRows(inv.kacchaPayments.map((p: any) => ({ mode: p.mode || "cash", amount: String(p.amount || ""), reference: p.reference || "" })));
    } else {
      setKacchaPayRows([]);
    }
    if (inv.kacchaCharges) {
      try { setKacchaCharges(typeof inv.kacchaCharges === "string" ? JSON.parse(inv.kacchaCharges) : inv.kacchaCharges); } catch { setKacchaCharges([]); }
    }
    if (inv.items?.length) {
      setItems(inv.items.map((i: any) => {
        return calc({
          stockItemId: i.stockItemId, batchId: i.batchId || undefined, itemName: i.itemName, hsnCode: i.hsnCode || "",
          quantity: Number(i.quantity), unit: i.unit, rate: Number(i.rate),
          discountPct: Number(i.discountPct) || 0, gstPct: Number(i.gstPct) || 0,
          gstLocked: !!i.stockItemId, gstInclusive: i.gstInclusive === true || i.gstInclusive === "true", isTaxLiability: i.isTaxLiability,
        }, interstate);
      }));
    }
  }, [existing]);

  useEffect(() => {
    if (!partyId) return;
    const party = (parties as any[]).find((p: any) => p.id === partyId);
    const interstate = party?.isOutOfState === "true" || party?.isOutOfState === true;
    setItems(prev => prev.map(item => calc(item, interstate)));
  }, [partyId]);

  const updateItem = (index: number, field: keyof Item, value: any) => {
    setItems(prev => {
      const u = [...prev];
      if (field === 'quantity' && typeof value === 'string') {
        if (!validateDecimalInput(value, u[index].isDecimalApplicable ?? true, u[index].decimalPlaces ?? 2)) return prev;
      }
      u[index] = calc({ ...u[index], [field]: value }, isInterstate);
      return u;
    });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      const gstPct = si.gstApplicable === "true" ? getGstRateForDate(si, date) : 0;
      setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], stockItemId: si.id, batchId: si.batchId ? Number(si.batchId) : undefined, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.purchaseRate, gstPct, quantity: si.unit === "n/a" ? 1 : u[index].quantity, gstLocked: true, isTaxLiability: si.isTaxLiability ?? true, isDecimalApplicable: si.isDecimalApplicable ?? true, decimalPlaces: si.decimalPlaces ?? 2 }, isInterstate); return u; });
    }
  };

  const clearItem = (index: number) => {
    setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], stockItemId: undefined, batchId: undefined, itemName: "", hsnCode: "", gstLocked: false, isTaxLiability: true }, isInterstate); return u; });
  };

  const handleQuickAdded = (newItem: any) => {
    queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey({}) });
    if (quickAddForIndex !== null) {
      const gstPct = newItem.gstApplicable === "true" ? getGstRateForDate(newItem, date) : 0;
      setItems(prev => { const u = [...prev]; u[quickAddForIndex] = calc({ ...u[quickAddForIndex], stockItemId: newItem.id, batchId: newItem.batchId ? Number(newItem.batchId) : undefined, itemName: newItem.name, unit: newItem.unit, rate: newItem.purchaseRate, gstPct, quantity: newItem.unit === "n/a" ? 1 : u[quickAddForIndex].quantity, gstLocked: true, isTaxLiability: newItem.isTaxLiability ?? true }, isInterstate); return u; });
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
    if (amountPaid > grandTotal + 0.01) e.payment = `Total payments (${formatCurrency(amountPaid)}) cannot exceed invoice total (${formatCurrency(grandTotal)})`;
    return e;
  };

  const buildPayload = () => {
    const party = (parties as any[]).find((p: any) => p.id === partyId);
    const payments = payRows.filter(r => Number(r.amount) > 0).map(r => ({ mode: r.mode, amount: Number(r.amount), reference: r.reference }));
    return {
      date, supplierInvoiceNumber: supplierInvNumber,
      partyId, partyName: party?.name || "",
      isGst: items.some(i => i.gstPct > 0), isInterstate, isReverseCharge: false,
      subtotal: totals.subtotal, totalTaxable: totals.taxable,
      totalCgst: totals.cgst, totalSgst: totals.sgst, totalIgst: totals.igst,
      grandTotal, amountPaid, balanceDue,
      notes,
        items: computedItems,
        payments,
      kacchaGrandTotal,
      kacchaAmountPaid,
      kacchaBalanceDue,
      kacchaSubtotal: rawKacchaSubtotal,
      kacchaPayments: kacchaPayRows.filter(r => Number(r.amount) > 0).map(r => ({ mode: r.mode, amount: Number(r.amount), reference: r.reference })),
      otherCharges: (!hasPakka ? [] : charges).length > 0 ? JSON.stringify(!hasPakka ? [] : charges) : null,
      kacchaCharges: (!hasPakka ? [...charges, ...kacchaCharges] : kacchaCharges).length > 0 ? JSON.stringify(!hasPakka ? [...charges, ...kacchaCharges] : kacchaCharges) : null,
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
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: getGetPurchaseInvoiceQueryKey(editId) });
      }
      queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey() });
      setLocation("/purchase/invoices");
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  
  useEffect(() => {
    if (!autoRoundOff) return;
    const hasPakka = computedItems.some(i => enableDualLedger ? i.isTaxLiability : true);
      const roundOffLedger = indirectLedgers.find(l => l.name === "Round Off");
      const roundOffId = roundOffLedger ? roundOffLedger.id : 0;
      
      // Auto round off Pakka
      const rawPakka = computedItems.filter(i => enableDualLedger ? i.isTaxLiability : true).reduce((acc, item) => acc + item.total, 0);
      const pakkaTotalBeforeRoundOff = rawPakka + charges.filter(c => (c.ledgerName || c.name) !== "Round Off").reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0);
      const roundedPakka = Math.round(pakkaTotalBeforeRoundOff);
      const diffPakka = roundedPakka - pakkaTotalBeforeRoundOff;
      
      setCharges(prev => {
        const filtered = prev.filter(c => (c.ledgerName || c.name) !== "Round Off");
        if (hasPakka && Math.abs(diffPakka) > 0.001) {
          filtered.push({ ledgerId: roundOffId, ledgerName: "Round Off", amount: Number(Math.abs(diffPakka).toFixed(2)) as any, type: diffPakka > 0 ? "add" : "deduct" });
        }
        return JSON.stringify(prev) === JSON.stringify(filtered) ? prev : filtered;
      });

      if (enableDualLedger) {
        const rawKaccha = computedItems.filter(i => !i.isTaxLiability).reduce((acc, item) => acc + item.total, 0);
        const kacchaTotalBeforeRoundOff = rawKaccha + (!hasPakka ? charges.filter(c => (c.ledgerName || c.name) !== "Round Off").reduce((s, c) => s + ((c.type ?? "add") === "deduct" ? -(Number(c.amount) || 0) : (Number(c.amount) || 0)), 0) : 0);
        const roundedKaccha = Math.round(kacchaTotalBeforeRoundOff);
        const diffKaccha = roundedKaccha - kacchaTotalBeforeRoundOff;
        
        setKacchaCharges(prev => {
          const filtered = prev.filter(c => (c.ledgerName || c.name) !== "Round Off");
          if (Math.abs(diffKaccha) > 0.001) {
            filtered.push({ ledgerId: roundOffId, ledgerName: "Round Off", amount: Number(Math.abs(diffKaccha).toFixed(2)) as any, type: diffKaccha > 0 ? "add" : "deduct" });
          }
          return JSON.stringify(prev) === JSON.stringify(filtered) ? prev : filtered;
        });
      }
    }, [autoRoundOff, computedItems, charges, kacchaCharges, enableDualLedger, indirectLedgers]);

  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Purchase Invoice" : "New Purchase Invoice"}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Supplier *</Label>
                    <button type="button" onClick={() => setShowAddParty(true)} className="text-xs text-primary hover:underline font-medium">+ Add Party</button>
                  </div>
                  <PartySelect
                    value={partyId}
                    onChange={v => { setPartyId(v); setErrors(p => { const n = { ...p }; delete n.party; return n; }); }}
                    parties={parties as any[]}
                    placeholder="Select supplier"
                    hasError={!!errors.party}
                  />
                  {errors.party && <p className="text-xs text-destructive">{errors.party}</p>}
                </div>
                <div className="space-y-1"><Label>Date *</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className={errors.date ? "border-destructive" : ""} /></div>
                <div className="space-y-1"><Label>Supplier Invoice#</Label><Input value={supplierInvNumber} onChange={e => setSupplierInvNumber(e.target.value)} placeholder="Supplier's invoice number" /></div>
              </div>
              {isInterstate && <div className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-2 rounded">Interstate supplier — IGST will apply</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Items</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}

              {/* Mobile card layout */}
              <div className="md:hidden space-y-3">
                {computedItems.map((item, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-3 bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">Item {i + 1}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <ItemSearchCombobox
                      stockItems={filteredStockItems}
                      itemName={item.itemName}
                      stockItemId={item.stockItemId}
                      onNameChange={v => updateItem(i, "itemName", v)}
                      onItemSelect={si => selectStock(i, String(si.id))}
                      onClear={() => clearItem(i)}
                      onQuickAdd={() => { setQuickAddForIndex(i); setQuickAddOpen(true); }}
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
                        <Select value={item.batchId ? String(item.batchId) : "none"} onValueChange={v => updateItem(i, "batchId", v === "none" ? undefined : Number(v))}>
                          <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="— none —" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— none —{item.stockItemId && stockAvail[item.stockItemId] ? ` · avail: ${stockAvail[item.stockItemId].unbatchedAvailable}` : ""}</SelectItem>
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
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Qty *</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.quantity || ""} disabled={item.unit === "n/a"} onChange={e => updateItem(i, "quantity", e.target.value)} /></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Unit</Label>{item.stockItemId ? (<div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>) : (<UnitSelect value={item.unit} onChange={v => updateItem(i, "unit", v)} className="h-10" />)}</div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Rate *</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></div>
                      {enableDiscount && (
                        <div className="space-y-1"><Label className="text-xs text-muted-foreground">Disc%</Label><Input className="h-10 text-base" type="number" inputMode="decimal" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} /></div>
                      )}
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
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">GST%</Label>{item.gstLocked ? (<div className="h-10 flex items-center gap-1.5 px-2 bg-muted rounded-md border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>) : (<Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}><SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select>)}</div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Total</Label><div className="h-10 flex items-center justify-end font-bold text-base">{formatCurrency(item.total)}</div></div>
                    </div>
                    {/* Inclusive GST breakdown */}
                    {item.quantity > 0 && item.rate > 0 && item.gstInclusive && item.gstPct > 0 && (
                      <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs space-y-1">
                        <p className="font-semibold text-amber-800 mb-1">GST Inclusive Breakdown</p>
                        <div className="flex justify-between text-amber-900"><span>Rate entered (incl. {item.gstPct}% GST)</span><span className="font-medium">{formatCurrency(item.rate)} × {item.quantity}</span></div>
                        {item.discountAmount > 0 && <div className="flex justify-between text-red-700"><span>Discount ({item.discountPct}%)</span><span>− {formatCurrency(item.discountAmount)}</span></div>}
                        <div className="flex justify-between text-green-800 font-medium"><span>Cost Price (base)</span><span>{formatCurrency(item.baseAmount)}</span></div>
                        <div className="flex justify-between text-blue-800 font-medium"><span>GST ({item.gstPct}%)</span><span>+ {formatCurrency(item.totalGst)}</span></div>
                        <div className="flex justify-between font-bold border-t border-amber-200 pt-1 mt-0.5 text-amber-900"><span>Item Total</span><span>{formatCurrency(item.total)}</span></div>
                      </div>
                    )}
                    {/* Standard breakdown for exclusive GST */}
                    {item.quantity > 0 && item.rate > 0 && (!item.gstInclusive || item.gstPct === 0) && (
                      <div className="mt-1 rounded-md bg-muted/40 px-3 py-2 text-xs space-y-0.5">
                        {item.discountAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(item.quantity * item.rate)}</span></div>}
                        {item.discountAmount > 0 && <div className="flex justify-between text-red-600"><span>Discount ({item.discountPct}%)</span><span>− {formatCurrency(item.discountAmount)}</span></div>}
                        <div className="flex justify-between text-muted-foreground"><span>{item.discountAmount > 0 ? "Taxable" : "Base amount"}</span><span>{formatCurrency(item.baseAmount)}</span></div>
                        {item.gstPct > 0 && <div className="flex justify-between text-muted-foreground"><span>GST ({item.gstPct}%)</span><span>+ {formatCurrency(item.totalGst)}</span></div>}
                        <div className="flex justify-between font-bold border-t border-border/60 pt-1 mt-1"><span>Total</span><span>{formatCurrency(item.total)}</span></div>
                      </div>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full h-10" onClick={() => setItems(prev => [...prev, calc({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 18, gstInclusive: false }, isInterstate)])}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
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
                      {enableDiscount && <TableHead className="w-20">Disc%</TableHead>}
                      <TableHead className="w-32">GST Type / %</TableHead>
                      <TableHead className="w-28 text-right">Taxable</TableHead>
                      <TableHead className="w-28 text-right">Total</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {computedItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <ItemSearchCombobox
                            stockItems={filteredStockItems}
                            itemName={item.itemName}
                            stockItemId={item.stockItemId}
                            onNameChange={v => updateItem(i, "itemName", v)}
                            onItemSelect={si => selectStock(i, String(si.id))}
                            onClear={() => clearItem(i)}
                            onQuickAdd={() => { setQuickAddForIndex(i); setQuickAddOpen(true); }}
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
                              <Select value={item.batchId ? String(item.batchId) : "none"} onValueChange={v => updateItem(i, "batchId", v === "none" ? undefined : Number(v))}>
                                <SelectTrigger className="h-6 text-xs py-0 flex-1 min-w-0"><SelectValue placeholder="— none —" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— none —{item.stockItemId && stockAvail[item.stockItemId] ? ` · avail: ${stockAvail[item.stockItemId].unbatchedAvailable}` : ""}</SelectItem>
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
                        <TableCell>{item.stockItemId ? (<div className="h-9 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.unit}</div>) : (<UnitSelect value={item.unit} onChange={v => updateItem(i, "unit", v)} className="h-9" />)}</TableCell>
                        <TableCell><Input className="h-9 text-sm" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                        {enableDiscount && (
                          <TableCell><Input className="h-9 text-sm" type="number" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(i, "discountPct", e.target.value)} /></TableCell>
                        )}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex rounded overflow-hidden border text-xs font-medium">
                              <button type="button" onClick={() => updateItem(i, "gstInclusive", false)}
                                className={`flex-1 px-1 py-0.5 transition-colors ${!item.gstInclusive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>Ex</button>
                              <button type="button" onClick={() => updateItem(i, "gstInclusive", true)}
                                className={`flex-1 px-1 py-0.5 border-l transition-colors ${item.gstInclusive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>In</button>
                            </div>
                            {item.gstLocked ? (<div className="h-8 flex items-center gap-1 px-2 bg-muted rounded border text-sm text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{item.gstPct}%</div>) : (<Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent></Select>)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(item.baseAmount)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                        <TableCell><Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setItems(prev => [...prev, calc({ itemName: "", unit: "pcs", quantity: 0, rate: 0, gstPct: 18, gstInclusive: false }, isInterstate)])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="border rounded-lg p-3 bg-muted/20">
                <OtherChargesSection charges={charges} onChange={setCharges} ledgers={indirectLedgers} />
              </div>
              <div className="space-y-1"><Label>Notes</Label><Textarea placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Totals + Payment */}
        <div className="space-y-4">
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
              {chargesTotal !== 0 && <div className="flex justify-between text-muted-foreground"><span>Additional Fields</span><span className={chargesTotal < 0 ? "text-red-600" : ""}>{chargesTotal < 0 ? "− " : "+ "}{formatCurrency(Math.abs(chargesTotal))}</span></div>}
              <div className="flex justify-between items-center font-bold text-base border-t pt-2">
                <span>Grand Total</span>
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
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
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
                <div key={i} className="flex flex-wrap gap-1.5 items-center">
                  <Select value={row.mode} onValueChange={v => updatePayRow(i, "mode", v)}>
                    <SelectTrigger className="h-8 text-xs w-full sm:w-[112px] shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-1.5 items-center flex-1 min-w-0">
                    <div className="relative flex-1 min-w-[70px]">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                      <Input className="pl-5 h-8 text-sm" type="number" inputMode="decimal" min="0" step="any"
                        value={row.amount}
                        onChange={e => { updatePayRow(i, "amount", e.target.value); setErrors(p => { const n = { ...p }; delete n.payment; return n; }); }}
                        placeholder="0.00" />
                    </div>
                    <Input className="h-8 text-xs flex-1 min-w-[60px]" placeholder="Ref / UTR" value={row.reference}
                      onChange={e => updatePayRow(i, "reference", e.target.value)} />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => setPayRows(p => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {errors.payment && <p className="text-xs text-destructive">{errors.payment}</p>}
              <div className="border-t pt-2 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{kacchaGrandTotal > 0 ? "Pakka Amount Paid" : "Amount Paid"}</span><span className="font-semibold text-green-600">{formatCurrency(amountPaid)}</span></div>
                <div className="flex justify-between font-bold"><span>{kacchaGrandTotal > 0 ? "Pakka Balance Due" : "Balance Due"}</span><span className={balanceDue > 0 ? "text-red-600" : "text-green-600"}>{formatCurrency(balanceDue)}</span></div>
              </div>

              {kacchaGrandTotal > 0 && (
                <>
                  <div className="flex items-center justify-between mb-1 mt-4 pt-4 border-t">
                    <span className="text-xs text-muted-foreground">Kaccha Payments</span>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                      onClick={() => setKacchaPayRows(p => [...p, { mode: "cash", amount: "", reference: "" }])}>
                      <Plus className="h-3.5 w-3.5" />Add Payment
                    </Button>
                  </div>
                  {kacchaPayRows.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1 italic">No kaccha payment recorded — balance will be due.</p>
                  )}
                  {kacchaPayRows.map((row, i) => (
                    <div key={i} className="flex flex-wrap gap-1.5 items-center">
                      <Select value={row.mode} onValueChange={v => updateKacchaPayRow(i, "mode", v)}>
                        <SelectTrigger className="h-8 text-xs w-full sm:w-[120px] shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="flex gap-1.5 items-center flex-1 min-w-0">
                        <div className="relative flex-1 min-w-[70px]">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₹</span>
                          <Input className="pl-5 h-8 text-sm" type="number" inputMode="decimal" min="0" step="any"
                            value={row.amount}
                            onChange={e => { updateKacchaPayRow(i, "amount", e.target.value); }}
                            placeholder="0.00" />
                        </div>
                        <Input className="h-8 text-xs flex-1 min-w-[60px]" placeholder="Ref / UTR" value={row.reference}
                          onChange={e => updateKacchaPayRow(i, "reference", e.target.value)} />
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => setKacchaPayRows(p => p.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-2 space-y-1 text-sm">
                    {kacchaChargesTotal !== 0 && <div className="flex justify-between text-muted-foreground"><span>Kaccha Additional</span><span className={kacchaChargesTotal < 0 ? "text-red-600" : ""}>{kacchaChargesTotal < 0 ? "- " : "+ "}{formatCurrency(Math.abs(kacchaChargesTotal))}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Kaccha Paid</span><span className="font-semibold text-amber-600">{formatCurrency(kacchaAmountPaid)}</span></div>
                    <div className="flex justify-between font-bold"><span>Kaccha Balance</span><span className={kacchaBalanceDue > 0 ? "text-red-600" : "text-amber-600"}>{formatCurrency(kacchaBalanceDue)}</span></div>
                  </div>
                </>
              )}
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
      <QuickAddPartyDialog
        open={showAddParty}
        onOpenChange={setShowAddParty}
        defaultAccountGroup="Sundry Creditors"
        onCreated={p => { setPartyId(p.id); setErrors(prev => { const n = { ...prev }; delete n.party; return n; }); }}
      />
    </form>
  );
}
