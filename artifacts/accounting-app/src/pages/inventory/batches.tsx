import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

const PAGE_SIZE = 20;

interface BatchItem { id: number; name: string; }
interface Batch {
  id: number;
  name: string;
  description?: string;
  expiryDate?: string;
  openingStock: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  items: BatchItem[];
}
interface StockItem { id: number; name: string; }

function BatchDialog({ batch, stockItems, batches, onSaved, onClose }: {
  batch?: Batch;
  stockItems: StockItem[];
  batches: Batch[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: batch?.name || "",
    description: batch?.description || "",
    expiryDate: batch?.expiryDate || "",
    openingStock: batch ? String(batch.openingStock ?? 0) : "",
  });
  const [selectedItem, setSelectedItem] = useState<number | null>(
    batch?.items?.[0]?.id ?? null
  );
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const availableItems = stockItems;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: "Batch name is required", variant: "destructive" }); return; }
    if (form.openingStock === "" || form.openingStock === null) { toast({ title: "Opening stock value is required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        openingStock: Number(form.openingStock) || 0,
        itemIds: selectedItem ? [selectedItem] : [],
      };
      if (batch) {
        await customFetch(`/api/stock-batches/${batch.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
      } else {
        await customFetch("/api/stock-batches", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
        });
      }
      toast({ title: batch ? "Batch updated" : "Batch created" });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error || "Failed to save", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>Batch Name *</Label>
        <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Batch-2024-A" autoFocus />
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Optional description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Expiry Date</Label>
          <Input type="date" value={form.expiryDate} onChange={e => set("expiryDate", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Opening Stock *</Label>
          <Input type="number" min="0" step="any" required value={form.openingStock} onChange={e => set("openingStock", e.target.value)} placeholder="Enter quantity" />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Assign Stock Item</Label>
        {stockItems.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No stock items found. Add items first.</p>
        ) : (
          <Select
            value={selectedItem ? String(selectedItem) : "none"}
            onValueChange={v => setSelectedItem(v === "none" ? null : Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a stock item (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {availableItems.map(item => (
                <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">One batch belongs to one item. One item can have multiple batches.</p>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : batch ? "Update Batch" : "Create Batch"}
      </Button>
    </form>
  );
}

export default function Batches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: batches = [], isLoading } = useFetch<Batch[]>("/api/stock-batches");
  const { data: stockItems = [] } = useFetch<StockItem[]>("/api/stock-items");
  const [newOpen, setNewOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [page, setPage] = useState(1);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/stock-batches"] });

  const deleteBatch = async (id: number) => {
    if (!confirm("Delete this batch? The assigned item will be unlinked.")) return;
    try {
      await customFetch(`/api/stock-batches/${id}`, { method: "DELETE" });
      toast({ title: "Batch deleted" });
      invalidate();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error || "Failed to delete", variant: "destructive" });
    }
  };

  const list = batches as Batch[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Stock Batches</h1>
          <p className="text-sm text-muted-foreground">{list.length} batches</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />New Batch</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Batch</DialogTitle></DialogHeader>
            <BatchDialog
              stockItems={stockItems as StockItem[]}
              batches={list}
              onSaved={invalidate}
              onClose={() => setNewOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Batches</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No batches yet. Create one to get started.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Assigned Item</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Physical</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(batch => {
                    const avail = Number(batch.availableStock ?? 0);
                    const isLow = avail <= 0;
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium">{batch.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{batch.description || "—"}</TableCell>
                        <TableCell className="text-sm">{batch.expiryDate || "—"}</TableCell>
                        <TableCell>
                          {batch.items?.[0] ? (
                            <Badge variant="secondary" className="text-xs font-normal">
                              <Package className="h-2.5 w-2.5 mr-1" />{batch.items[0].name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{Number(batch.openingStock ?? 0)}</TableCell>
                        <TableCell className="text-right text-sm">{Number(batch.physicalStock ?? 0)}</TableCell>
                        <TableCell className="text-right text-sm text-amber-600">{Number(batch.reservedStock ?? 0)}</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-medium flex items-center justify-end gap-1 ${isLow ? "text-red-600" : "text-green-600"}`}>
                            {isLow && <AlertTriangle className="h-3 w-3" />}
                            {avail}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Dialog open={editBatch?.id === batch.id} onOpenChange={open => !open && setEditBatch(null)}>
                              <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditBatch(batch)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader><DialogTitle>Edit Batch</DialogTitle></DialogHeader>
                                {editBatch?.id === batch.id && (
                                  <BatchDialog
                                    batch={editBatch}
                                    stockItems={stockItems as StockItem[]}
                                    batches={list}
                                    onSaved={invalidate}
                                    onClose={() => setEditBatch(null)}
                                  />
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteBatch(batch.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
