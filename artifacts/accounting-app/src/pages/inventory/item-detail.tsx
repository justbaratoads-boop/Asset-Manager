import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetStockItem, useGetStockItemTransactions, useAdjustStock, getGetStockItemQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ArrowLeft, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";

interface GstHistoryEntry {
  id: number;
  oldRate: number;
  newRate: number;
  changedAt: string;
}

interface InvoicedByRate {
  rate: number;
  saleAmount: number;
  purchaseAmount: number;
  saleCount: number;
  purchaseCount: number;
}

interface GstHistoryData {
  history: GstHistoryEntry[];
  invoicedByRate: InvoicedByRate[];
}

const txTypeStyle: Record<string, string> = {
  sale: "bg-red-100 text-red-700",
  purchase: "bg-green-100 text-green-700",
};

export default function ItemDetail() {
  const [, params] = useRoute("/inventory/items/:id");
  const id = Number(params?.id);
  const { data: item, isLoading } = useGetStockItem(id, { query: { enabled: !!id } });
  const { data: txs = [] } = useGetStockItemTransactions(id, { query: { enabled: !!id } });
  const { data: gstHistory } = useFetch<GstHistoryData>(`/api/stock-items/${id}/gst-history`, !!id);
  const adjustMutation = useAdjustStock();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjQty, setAdjQty] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [gstOpen, setGstOpen] = useState(false);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    await adjustMutation.mutateAsync({ id, data: { quantity: Number(adjQty), reason: adjReason } as any });
    queryClient.invalidateQueries({ queryKey: getGetStockItemQueryKey(id) });
    setAdjOpen(false);
    toast({ title: "Stock adjusted" });
  };

  if (isLoading) return <div className="text-center p-8 text-muted-foreground">Loading...</div>;
  if (!item) return <div className="text-center p-8 text-muted-foreground">Item not found</div>;

  const it = item as any;
  const currentGst = it.gstApplicable === "true" || it.gstApplicable === true
    ? `${it.gstRate}%`
    : "Not applicable";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/inventory/items"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <div>
            <h1 className="text-xl font-bold">{it.name}</h1>
            <p className="text-sm text-muted-foreground">
              {it.hsnCode && `HSN: ${it.hsnCode} · `}{it.unit} · GST: {currentGst}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* GST History Dialog */}
          <Dialog open={gstOpen} onOpenChange={setGstOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-2" />GST History
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>GST History — {it.name}</DialogTitle></DialogHeader>
              <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
                {/* Invoiced amounts by rate */}
                <div>
                  <p className="text-sm font-semibold mb-2">Invoiced Amount by GST Rate</p>
                  {(!gstHistory?.invoicedByRate || gstHistory.invoicedByRate.length === 0) ? (
                    <p className="text-sm text-muted-foreground py-2">No bills found for this item.</p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="md:hidden space-y-2">
                        {gstHistory.invoicedByRate.map(r => (
                          <div key={r.rate} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">{r.rate}%</Badge>
                              <span className="text-xs font-semibold">{formatCurrency(r.saleAmount + r.purchaseAmount)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Sale ({r.saleCount})</p>
                                <p className="font-medium">{formatCurrency(r.saleAmount)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Purchase ({r.purchaseCount})</p>
                                <p className="font-medium">{formatCurrency(r.purchaseAmount)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>GST Rate</TableHead>
                              <TableHead className="text-right">Sale Invoices</TableHead>
                              <TableHead className="text-right">Sale Amount</TableHead>
                              <TableHead className="text-right">Purchase Invoices</TableHead>
                              <TableHead className="text-right">Purchase Amount</TableHead>
                              <TableHead className="text-right">Total Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gstHistory.invoicedByRate.map(r => (
                              <TableRow key={r.rate}>
                                <TableCell><Badge variant="secondary">{r.rate}%</Badge></TableCell>
                                <TableCell className="text-right text-sm">{r.saleCount}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(r.saleAmount)}</TableCell>
                                <TableCell className="text-right text-sm">{r.purchaseCount}</TableCell>
                                <TableCell className="text-right text-sm">{formatCurrency(r.purchaseAmount)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(r.saleAmount + r.purchaseAmount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>

                {/* Change log */}
                <div>
                  <p className="text-sm font-semibold mb-2">GST Rate Change Log</p>
                  {(!gstHistory?.history || gstHistory.history.length === 0) ? (
                    <p className="text-sm text-muted-foreground py-2">No GST rate changes recorded yet.</p>
                  ) : (
                    <>
                      {/* Mobile cards */}
                      <div className="md:hidden space-y-2">
                        {gstHistory.history.map(h => (
                          <div key={h.id} className="border rounded-lg p-3 flex items-center justify-between gap-3 bg-muted/30">
                            <span className="text-xs text-muted-foreground">
                              {new Date(h.changedAt).toLocaleString("en-IN", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-muted-foreground">{h.oldRate}%</Badge>
                              <span className="text-muted-foreground text-xs">→</span>
                              <Badge variant="secondary">{h.newRate}%</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date & Time</TableHead>
                              <TableHead className="text-right">Previous Rate</TableHead>
                              <TableHead className="text-right">New Rate</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {gstHistory.history.map(h => (
                              <TableRow key={h.id}>
                                <TableCell className="text-sm">
                                  {new Date(h.changedAt).toLocaleString("en-IN", {
                                    day: "2-digit", month: "short", year: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                  })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className="text-muted-foreground">{h.oldRate}%</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="secondary">{h.newRate}%</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Stock Adjustment Dialog */}
          <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
            <DialogTrigger asChild><Button variant="outline">Adjust Stock</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Stock Adjustment</DialogTitle></DialogHeader>
              <form onSubmit={handleAdjust} className="space-y-4">
                <p className="text-sm text-muted-foreground">Current stock: {it.physicalStock} {it.unit}</p>
                <div className="space-y-1"><Label>Quantity (+ to add, − to reduce)</Label><Input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} required /></div>
                <div className="space-y-1"><Label>Reason</Label><Input value={adjReason} onChange={e => setAdjReason(e.target.value)} /></div>
                <Button type="submit" className="w-full" disabled={adjustMutation.isPending}>Apply Adjustment</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Current Stock</p><p className="text-2xl font-bold">{it.physicalStock} {it.unit}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Min Level</p><p className="text-2xl font-bold">{it.minStockLevel}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Purchase Rate</p><p className="text-2xl font-bold">{formatCurrency(it.purchaseRate)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sale Rate</p><p className="text-2xl font-bold">{formatCurrency(it.saleRate)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
        <CardContent>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {(txs as any[]).length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No transactions</p>
            ) : (txs as any[]).map((t: any) => (
              <div key={t.id} className="border rounded-lg p-3 space-y-1.5 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`capitalize text-xs ${txTypeStyle[t.type] || "bg-blue-100 text-blue-700"}`}>
                    {t.type.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-mono text-xs truncate max-w-[160px]">
                    {t.reference || t.reason || "—"}
                  </span>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{t.quantity > 0 ? "+" : ""}{t.quantity} {it.unit}</p>
                    <p className="text-xs text-muted-foreground">Bal: {t.balanceAfter} {it.unit}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(txs as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No transactions</TableCell></TableRow>
                ) : (txs as any[]).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{new Date(t.createdAt).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize text-xs ${txTypeStyle[t.type] || "bg-blue-100 text-blue-700"}`}>
                        {t.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{t.reference || t.reason || "-"}</TableCell>
                    <TableCell className="text-right">{t.quantity} {it.unit}</TableCell>
                    <TableCell className="text-right font-medium">{t.balanceAfter} {it.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
