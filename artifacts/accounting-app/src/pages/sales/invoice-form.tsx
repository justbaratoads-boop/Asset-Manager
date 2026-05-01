import { useState, useEffect } from "react";
import { useCreateSaleInvoice, useListParties, useListStockItems, getListSaleInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Printer, Send, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { customFetch } from "@workspace/api-client-react";

interface InvoiceItem {
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

function calcItem(item: Partial<InvoiceItem>, isInterstate: boolean): InvoiceItem {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const discPct = Number(item.discountPct) || 0;
  const gstPct = Number(item.gstPct) || 0;
  const subtotal = qty * rate;
  const discount = subtotal * (discPct / 100);
  const taxable = subtotal - discount;
  const gstAmount = taxable * (gstPct / 100);
  const cgst = isInterstate ? 0 : gstAmount / 2;
  const sgst = isInterstate ? 0 : gstAmount / 2;
  const igst = isInterstate ? gstAmount : 0;
  return {
    stockItemId: item.stockItemId,
    itemName: item.itemName || "",
    hsnCode: item.hsnCode || "",
    quantity: qty,
    unit: item.unit || "pcs",
    rate,
    discountPct: discPct,
    gstPct,
    taxableAmount: taxable,
    cgst, sgst, igst,
    total: taxable + gstAmount,
  };
}

export default function SaleInvoiceForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSaleInvoice();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});

  // Read fromOrder param from URL
  const fromOrderId = new URLSearchParams(window.location.search).get("fromOrder");

  const [paymentMode, setPaymentMode] = useState<"cash" | "credit">("credit");
  const [partyId, setPartyId] = useState<number | undefined>();
  const [manualName, setManualName] = useState("");
  const [date, setDate] = useState(today());
  const [isInterstate, setIsInterstate] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 0 }, false)]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const selectedParty = (parties as any[]).find((p: any) => p.id === partyId);

  // When party selected, auto-set interstate from party.isOutOfState
  useEffect(() => {
    if (selectedParty) {
      const interstate = selectedParty.isOutOfState === "true" || selectedParty.isOutOfState === true;
      setIsInterstate(interstate);
      setItems(prev => prev.map(item => calcItem(item, interstate)));
    }
  }, [partyId]);

  // Pre-fill from order
  useEffect(() => {
    if (!fromOrderId) return;
    customFetch<any>(`/api/orders/${fromOrderId}`).then(order => {
      if (order.partyId) setPartyId(order.partyId);
      if (order.date) setDate(order.date);
      if (order.notes) setNotes(order.notes);
      if (order.items?.length) {
        setItems(order.items.map((i: any) => calcItem({
          stockItemId: i.stockItemId,
          itemName: i.itemName,
          hsnCode: i.hsnCode || "",
          quantity: Number(i.quantity),
          unit: i.unit,
          rate: Number(i.rate),
          discountPct: Number(i.discountPct) || 0,
          gstPct: Number(i.gstPct) || 0,
        }, false)));
      }
    }).catch(() => {});
  }, [fromOrderId]);

  const totals = items.reduce((acc, item) => ({
    subtotal: acc.subtotal + item.quantity * item.rate,
    discount: acc.discount + (item.quantity * item.rate - item.taxableAmount),
    taxable: acc.taxable + item.taxableAmount,
    cgst: acc.cgst + item.cgst,
    sgst: acc.sgst + item.sgst,
    igst: acc.igst + item.igst,
    grand: acc.grand + item.total,
  }), { subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 });

  const totalPaid = paymentMode === "cash" ? totals.grand : 0;
  const balance = totals.grand - totalPaid;

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
        updated[index] = calcItem({
          ...updated[index],
          stockItemId: si.id,
          itemName: si.name,
          hsnCode: si.hsnCode || "",
          unit: si.unit,
          rate: si.saleRate,
          gstPct,
        }, isInterstate);
        return updated;
      });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (paymentMode === "credit" && !partyId) e.party = "Party is required for credit invoices";
    if (!date) e.date = "Date is required";
    for (let i = 0; i < items.length; i++) {
      if (!items[i].itemName) { e.items = `Row ${i + 1}: Item name is required`; break; }
      if (!items[i].quantity || items[i].quantity <= 0) { e.items = `Row ${i + 1}: Quantity must be greater than 0`; break; }
      if (!items[i].rate || items[i].rate <= 0) { e.items = `Row ${i + 1}: Rate must be greater than 0`; break; }
    }
    if (items.length === 0) e.items = "Add at least one item";
    return e;
  };

  const buildPayload = () => {
    const partyName = paymentMode === "credit"
      ? (selectedParty?.name || "")
      : (manualName || "Cash Sale");

    return {
      date,
      partyId: paymentMode === "credit" ? partyId : undefined,
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
      grandTotal: totals.grand,
      amountPaid: totalPaid,
      balanceDue: balance,
      notes,
      items,
      payments: paymentMode === "cash" && totals.grand > 0 ? [{ mode: "cash", amount: totals.grand, reference: "" }] : [],
    };
  };

  const handleSave = async (then?: (inv: any) => void) => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setIsSaving(true);
    try {
      const inv = await createMutation.mutateAsync({ data: buildPayload() as any });
      queryClient.invalidateQueries({ queryKey: getListSaleInvoicesQueryKey() });
      toast({ title: "Invoice created successfully" });
      if (then) then(inv);
      else setLocation("/sales/invoices");
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "Failed to create invoice";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  const handleSaveAndPrint = () => {
    handleSave((inv: any) => {
      const id = inv?.id || inv?.invoiceId;
      if (id) setLocation(`/sales/invoices/${id}?print=1`);
      else setLocation("/sales/invoices");
    });
  };

  const handleSaveAndSend = () => {
    toast({ title: "WhatsApp sharing coming soon", description: "Invoice will be saved first" });
    handleSave();
  };

  const handlePrintOnly = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    toast({ title: "Save the invoice first before printing" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/sales/invoices"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">
          {fromOrderId ? "New Invoice (from Order)" : "New Sale Invoice"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-4">
            {/* Payment Mode toggle */}
            <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg">
              <span className="text-sm font-medium">Bill Type:</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode("credit")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${paymentMode === "credit" ? "bg-primary text-primary-foreground" : "bg-background border"}`}
                >Credit</button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("cash")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${paymentMode === "cash" ? "bg-primary text-primary-foreground" : "bg-background border"}`}
                >Cash</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {paymentMode === "credit" ? (
                <div className="space-y-1">
                  <Label>Party *</Label>
                  <Select value={partyId ? String(partyId) : ""} onValueChange={v => { setPartyId(Number(v)); setErrors(p => { const n = { ...p }; delete n.party; return n; }); }}>
                    <SelectTrigger className={errors.party ? "border-destructive" : ""}><SelectValue placeholder="Select party" /></SelectTrigger>
                    <SelectContent>{(parties as any[]).filter((p: any) => p.type === "customer" || p.type === "both").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
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

            {/* Items table */}
            {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Item</TableHead>
                    <TableHead className="w-20">Qty *</TableHead>
                    <TableHead className="w-16">Unit</TableHead>
                    <TableHead className="w-24">Rate *</TableHead>
                    <TableHead className="w-16">Disc%</TableHead>
                    <TableHead className="w-20">GST%</TableHead>
                    <TableHead className="w-24 text-right">Total</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select onValueChange={v => selectStockItem(index, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select item" /></SelectTrigger>
                          <SelectContent>{(stockItems as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {!item.stockItemId && (
                          <Input
                            className="h-7 mt-1 text-xs"
                            placeholder="Item name *"
                            value={item.itemName}
                            onChange={e => updateItem(index, "itemName", e.target.value)}
                          />
                        )}
                        {item.stockItemId && (
                          <div className="text-xs text-muted-foreground mt-1 px-1">{item.itemName}</div>
                        )}
                      </TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" min="0.001" step="any" value={item.quantity || ""} onChange={e => updateItem(index, "quantity", e.target.value)} placeholder="Qty" /></TableCell>
                      <TableCell><Input className="h-7 text-xs" value={item.unit} onChange={e => updateItem(index, "unit", e.target.value)} /></TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" min="0" step="any" value={item.rate || ""} onChange={e => updateItem(index, "rate", e.target.value)} placeholder="Rate" /></TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" min="0" max="100" value={item.discountPct || ""} onChange={e => updateItem(index, "discountPct", e.target.value)} placeholder="0" /></TableCell>
                      <TableCell>
                        <Select value={String(item.gstPct)} onValueChange={v => updateItem(index, "gstPct", v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                      <TableCell>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== index))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 0 }, isInterstate)])}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Item
              </Button>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

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
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span>{formatCurrency(totals.grand)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Payment</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {paymentMode === "cash" ? (
                <div className="space-y-1">
                  <div className="flex justify-between font-medium text-green-700">
                    <span>Amount Received</span>
                    <span>{formatCurrency(totals.grand)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Cash sale: amount equals bill total</p>
                </div>
              ) : (
                <div className="flex justify-between font-semibold">
                  <span>Balance Due</span>
                  <span className="text-red-600">{formatCurrency(balance)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action buttons at bottom */}
      <div className="flex flex-wrap gap-3 pt-2 border-t">
        <Button type="submit" disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />{isSaving ? "Saving..." : "Save Invoice"}
        </Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={handleSaveAndPrint} className="gap-2">
          <Printer className="h-4 w-4" />Save &amp; Print
        </Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={handleSaveAndSend} className="gap-2">
          <Send className="h-4 w-4" />Save &amp; Send
        </Button>
        <Button type="button" variant="ghost" onClick={handlePrintOnly} className="gap-2">
          <Printer className="h-4 w-4" />Print Only
        </Button>
      </div>
    </form>
  );
}
