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
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

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

interface Payment {
  mode: string;
  amount: number;
  reference: string;
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
  const total = taxable + gstAmount;

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
    cgst,
    sgst,
    igst,
    total,
  };
}

export default function SaleInvoiceForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSaleInvoice();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});

  const [partyId, setPartyId] = useState<number | undefined>();
  const [date, setDate] = useState(today());
  const [isInterstate, setIsInterstate] = useState(false);
  const [isGst, setIsGst] = useState(true);
  const [items, setItems] = useState<InvoiceItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, false)]);
  const [payments, setPayments] = useState<Payment[]>([{ mode: "cash", amount: 0, reference: "" }]);
  const [notes, setNotes] = useState("");

  const selectedParty = (parties as any[]).find((p: any) => p.id === partyId);

  const totals = items.reduce((acc, item) => ({
    subtotal: acc.subtotal + item.quantity * item.rate,
    discount: acc.discount + item.taxableAmount - (item.quantity * item.rate * (1 - item.discountPct / 100)),
    taxable: acc.taxable + item.taxableAmount,
    cgst: acc.cgst + item.cgst,
    sgst: acc.sgst + item.sgst,
    igst: acc.igst + item.igst,
    grand: acc.grand + item.total,
  }), { subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 });

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = totals.grand - totalPaid;

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = calcItem({ ...updated[index], [field]: value }, isInterstate);
      return updated;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 }, isInterstate)]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const selectStockItem = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) {
      updateItem(index, "stockItemId" as any, si.id);
      setItems(prev => {
        const updated = [...prev];
        updated[index] = calcItem({
          ...updated[index],
          stockItemId: si.id,
          itemName: si.name,
          hsnCode: si.hsnCode || "",
          unit: si.unit,
          rate: si.saleRate,
        }, isInterstate);
        return updated;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        data: {
          date,
          partyId: partyId,
          partyName: selectedParty?.name || "Walk-in",
          partyGstin: selectedParty?.gstin,
          billingAddress: selectedParty ? `${selectedParty.city}, ${selectedParty.state}` : "",
          isGst,
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
          payments: payments.filter(p => p.amount > 0),
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListSaleInvoicesQueryKey() });
      toast({ title: "Invoice created successfully" });
      setLocation("/sales/invoices");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales/invoices"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <h1 className="text-xl font-bold">New Sale Invoice</h1>
        </div>
        <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Save Invoice"}</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Party</Label>
                <Select onValueChange={v => setPartyId(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Select party / walk-in" /></SelectTrigger>
                  <SelectContent>
                    {(parties as any[]).filter((p: any) => p.type === "customer" || p.type === "both").map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={isGst} onCheckedChange={setIsGst} id="gst" />
                <Label htmlFor="gst">GST Invoice</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isInterstate} onCheckedChange={v => {
                  setIsInterstate(v);
                  setItems(prev => prev.map(item => calcItem(item, v)));
                }} id="interstate" />
                <Label htmlFor="interstate">Interstate (IGST)</Label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Item</TableHead>
                    <TableHead className="w-28">HSN</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="w-24">Rate</TableHead>
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
                          <SelectContent>
                            {(stockItems as any[]).map((s: any) => (
                              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input className="h-7 mt-1 text-xs" placeholder="Or type name" value={item.itemName} onChange={e => updateItem(index, "itemName", e.target.value)} />
                      </TableCell>
                      <TableCell><Input className="h-7 text-xs" value={item.hsnCode} onChange={e => updateItem(index, "hsnCode", e.target.value)} /></TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" value={item.quantity} onChange={e => updateItem(index, "quantity", e.target.value)} /></TableCell>
                      <TableCell><Input className="h-7 text-xs" value={item.unit} onChange={e => updateItem(index, "unit", e.target.value)} /></TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" value={item.rate} onChange={e => updateItem(index, "rate", e.target.value)} /></TableCell>
                      <TableCell><Input className="h-7 text-xs" type="number" value={item.discountPct} onChange={e => updateItem(index, "discountPct", e.target.value)} /></TableCell>
                      <TableCell>
                        <Select value={String(item.gstPct)} onValueChange={v => updateItem(index, "gstPct", v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                      <TableCell>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(index)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addItem}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} />
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
              {!isInterstate && totals.cgst > 0 && <><div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{formatCurrency(totals.cgst)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{formatCurrency(totals.sgst)}</span></div></>}
              {isInterstate && totals.igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{formatCurrency(totals.igst)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span>{formatCurrency(totals.grand)}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Payments</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {payments.map((payment, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <Select value={payment.mode} onValueChange={v => setPayments(prev => prev.map((p, j) => j === i ? { ...p, mode: v } : p))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["cash", "upi", "cheque", "bank_transfer", "credit"].map(m => (
                        <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="h-8 text-xs" type="number" placeholder="Amount" value={payment.amount || ""} onChange={e => setPayments(prev => prev.map((p, j) => j === i ? { ...p, amount: Number(e.target.value) } : p))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setPayments(prev => [...prev, { mode: "cash", amount: 0, reference: "" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Payment Mode
              </Button>
              <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                <span>Balance Due</span>
                <span className={balance > 0 ? "text-red-600" : "text-green-600"}>{formatCurrency(balance)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
