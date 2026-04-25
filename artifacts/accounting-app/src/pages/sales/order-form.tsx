import { useState } from "react";
import { useCreateOrder, useListParties, useListStockItems, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, today, GST_RATES } from "@/lib/format";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
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
  const subtotal = qty * rate;
  const discount = subtotal * (discPct / 100);
  const taxable = subtotal - discount;
  const gstAmount = taxable * (gstPct / 100);
  return {
    stockItemId: item.stockItemId,
    itemName: item.itemName || "",
    hsnCode: item.hsnCode || "",
    quantity: qty, unit: item.unit || "pcs", rate,
    discountPct: discPct, gstPct,
    taxableAmount: taxable,
    cgst: gstAmount / 2, sgst: gstAmount / 2, igst: 0,
    total: taxable + gstAmount,
  };
}

export default function OrderForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateOrder();
  const { data: parties = [] } = useListParties();
  const { data: stockItems = [] } = useListStockItems({});

  const [partyId, setPartyId] = useState<number | undefined>();
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 })]);

  const grandTotal = items.reduce((s, i) => s + i.total, 0);

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], [field]: value }); return u; });
  };

  const selectStock = (index: number, id: string) => {
    const si = (stockItems as any[]).find((s: any) => s.id === Number(id));
    if (si) setItems(prev => { const u = [...prev]; u[index] = calcItem({ ...u[index], stockItemId: si.id, itemName: si.name, hsnCode: si.hsnCode || "", unit: si.unit, rate: si.saleRate }); return u; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const party = (parties as any[]).find((p: any) => p.id === partyId);
    try {
      await createMutation.mutateAsync({ data: { date, partyId, partyName: party?.name || "Walk-in", notes, grandTotal, items } as any });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Order created" });
      setLocation("/sales/orders");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales/orders"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <h1 className="text-xl font-bold">New Order</h1>
        </div>
        <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Save Order"}</Button>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Party</Label>
              <Select onValueChange={v => setPartyId(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
                <SelectContent>{(parties as any[]).filter((p: any) => p.type === "customer" || p.type === "both").map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
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
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Item" /></SelectTrigger>
                      <SelectContent>{(stockItems as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="h-7 mt-1 text-xs" placeholder="Name" value={item.itemName} onChange={e => updateItem(i, "itemName", e.target.value)} />
                  </TableCell>
                  <TableCell><Input className="h-7 text-xs" type="number" value={item.quantity} onChange={e => updateItem(i, "quantity", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-7 text-xs" value={item.unit} onChange={e => updateItem(i, "unit", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-7 text-xs" type="number" value={item.rate} onChange={e => updateItem(i, "rate", e.target.value)} /></TableCell>
                  <TableCell>
                    <Select value={String(item.gstPct)} onValueChange={v => updateItem(i, "gstPct", v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                  <TableCell><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, calcItem({ itemName: "", unit: "pcs", quantity: 1, rate: 0, gstPct: 18 })])}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
            <div className="font-bold">Total: {formatCurrency(grandTotal)}</div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." /></div>
        </CardContent>
      </Card>
    </form>
  );
}
