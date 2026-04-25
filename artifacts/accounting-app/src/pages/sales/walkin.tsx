import { useState } from "react";
import { useCreateSaleInvoice, useListStockItems, getListSaleInvoicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Item { itemName: string; hsnCode: string; quantity: number; unit: string; rate: number; gstPct: number; taxableAmount: number; cgst: number; sgst: number; igst: number; total: number; }

function calc(item: Partial<Item>): Item {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  const gstPct = Number(item.gstPct) || 0;
  const taxable = qty * rate;
  const gstAmount = taxable * (gstPct / 100);
  return { itemName: item.itemName || "", hsnCode: item.hsnCode || "", quantity: qty, unit: item.unit || "pcs", rate, gstPct, taxableAmount: taxable, cgst: gstAmount / 2, sgst: gstAmount / 2, igst: 0, total: taxable + gstAmount };
}

export default function WalkinSale() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSaleInvoice();
  const { data: stockItems = [] } = useListStockItems({});
  const [date, setDate] = useState(today());
  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<Item[]>([calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 })]);
  const [paymentMode, setPaymentMode] = useState("cash");
  const grand = items.reduce((s, i) => s + i.total, 0);

  const updateItem = (index: number, field: keyof Item, value: any) => {
    setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], [field]: value }); return u; });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) setItems(prev => { const u = [...prev]; u[index] = calc({ ...u[index], itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.saleRate }); return u; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        data: {
          date, partyName: customerName || "Walk-in Customer",
          isGst: true, isInterstate: false,
          subtotal: grand, totalDiscount: 0, totalTaxable: grand, totalCgst: items.reduce((s, i) => s + i.cgst, 0), totalSgst: items.reduce((s, i) => s + i.sgst, 0), totalIgst: 0, totalGst: items.reduce((s, i) => s + i.cgst + i.sgst, 0),
          grandTotal: grand, amountPaid: grand, balanceDue: 0, status: "paid",
          items, payments: [{ mode: paymentMode, amount: grand, reference: "" }],
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListSaleInvoicesQueryKey() });
      toast({ title: "Walk-in sale recorded" });
      setLocation("/sales/invoices");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Walk-in Sale</h1>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Customer Name</Label><Input placeholder="Walk-in Customer" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
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
                    <Input className="h-7 mt-1 text-xs" placeholder="Name" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />
                  </TableCell>
                  <TableCell><Input className="h-7 text-xs" type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-7 text-xs" type="number" value={item.rate} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                  <TableCell>
                    <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                  <TableCell><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, calc({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 })])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
          <div className="flex items-center gap-4 pt-4 border-t">
            <div className="space-y-1 flex-1">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["cash", "upi", "cheque", "bank_transfer"].map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">{formatCurrency(grand)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Button type="submit" size="lg" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? "Processing..." : `Collect ${formatCurrency(grand)}`}</Button>
    </form>
  );
}
