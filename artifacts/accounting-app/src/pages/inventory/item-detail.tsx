import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetStockItem, useGetStockItemTransactions, useAdjustStock, getGetStockItemQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ItemDetail() {
  const [, params] = useRoute("/inventory/items/:id");
  const id = Number(params?.id);
  const { data: item, isLoading } = useGetStockItem(id, { query: { enabled: !!id } });
  const { data: txs = [] } = useGetStockItemTransactions(id, { query: { enabled: !!id } });
  const adjustMutation = useAdjustStock();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjQty, setAdjQty] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    await adjustMutation.mutateAsync({ id, data: { quantity: Number(adjQty), reason: adjReason } as any });
    queryClient.invalidateQueries({ queryKey: getGetStockItemQueryKey(id) });
    setAdjOpen(false);
    toast({ title: "Stock adjusted" });
  };

  if (isLoading) return <div className="text-center p-8 text-muted-foreground">Loading...</div>;
  if (!item) return <div className="text-center p-8 text-muted-foreground">Item not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/inventory/items"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <div>
            <h1 className="text-xl font-bold">{(item as any).name}</h1>
            <p className="text-sm text-muted-foreground">{(item as any).hsnCode && `HSN: ${(item as any).hsnCode}`} · {(item as any).unit}</p>
          </div>
        </div>
        <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
          <DialogTrigger asChild><Button variant="outline">Adjust Stock</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Stock Adjustment</DialogTitle></DialogHeader>
            <form onSubmit={handleAdjust} className="space-y-4">
              <p className="text-sm text-muted-foreground">Current stock: {(item as any).physicalStock} {(item as any).unit}</p>
              <div className="space-y-1"><Label>Quantity (+ to add, - to reduce)</Label><Input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} required /></div>
              <div className="space-y-1"><Label>Reason</Label><Input value={adjReason} onChange={e => setAdjReason(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={adjustMutation.isPending}>Apply Adjustment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Current Stock</p><p className="text-2xl font-bold">{(item as any).physicalStock} {(item as any).unit}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Min Level</p><p className="text-2xl font-bold">{(item as any).minStockLevel}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Purchase Rate</p><p className="text-2xl font-bold">{formatCurrency((item as any).purchaseRate)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sale Rate</p><p className="text-2xl font-bold">{formatCurrency((item as any).saleRate)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {(txs as any[]).length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No transactions</TableCell></TableRow>
                : (txs as any[]).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{new Date(t.createdAt).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell><Badge variant="outline" className={`capitalize text-xs ${t.type === "sale" ? "bg-red-100 text-red-700" : t.type === "purchase" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{t.type.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{t.reference || t.reason || "-"}</TableCell>
                    <TableCell className="text-right">{t.quantity} {(item as any).unit}</TableCell>
                    <TableCell className="text-right font-medium">{t.balanceAfter} {(item as any).unit}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
