import { useState } from "react";
import { Link } from "wouter";
import { useListStockItems, useDeleteStockItem, getListStockItemsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { Plus, Search, Eye, Trash2, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function StockItemList() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: items = [], isLoading } = useListStockItems({ search: search || undefined });
  const deleteMutation = useDeleteStockItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Stock Items</h1>
        <Link href="/inventory/items/new"><Button><Plus className="h-4 w-4 mr-2" />New Item</Button></Link>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>HSN</TableHead><TableHead>Unit</TableHead><TableHead className="text-right">Purchase Rate</TableHead><TableHead className="text-right">Sale Rate</TableHead><TableHead className="text-right">Stock</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : (items as any[]).length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No items found</TableCell></TableRow>
                  : (items as any[]).map((item: any) => {
                    const isLow = item.physicalStock <= item.minStockLevel;
                    return (
                      <TableRow key={item.id} className={cn(isLow && "bg-amber-50")}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                            {item.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{item.hsnCode || "-"}</TableCell>
                        <TableCell className="text-sm">{item.unit}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(item.purchaseRate)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(item.saleRate)}</TableCell>
                        <TableCell className="text-right">
                          <span className={isLow ? "text-amber-600 font-medium" : ""}>{item.physicalStock} {item.unit}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Link href={`/inventory/items/${item.id}`}><Button size="icon" variant="ghost" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button></Link>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
