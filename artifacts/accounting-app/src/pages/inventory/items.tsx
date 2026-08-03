import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useListStockItems, useDeleteStockItem, getListStockItemsQueryKey, useGetCompanySettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { Plus, Search, Eye, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function StockItemList() {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const { data: items = [], isLoading } = useListStockItems({ search: search || undefined });
  const deleteMutation = useDeleteStockItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companySettings } = useGetCompanySettings();
  const enableDualLedger = (companySettings as any)?.enableDualLedger ?? false;

  useEffect(() => { setPage(1); }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to delete";
      toast({ title: "Cannot delete", description: msg, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const list = useMemo(() => {
    const arr = items as any[];
    if (enableDualLedger) return arr;
    return arr.filter(item => item.isTaxLiability !== false && String(item.isTaxLiability) !== "false");
  }, [items, enableDualLedger]);
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Stock Items</h1>
          <p className="text-sm text-muted-foreground">{list.length} items</p>
        </div>
        <Link href="/inventory/items/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Item</Button></Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No items found</div>
        ) : paginated.map((item: any) => {
          const isLow = item.physicalStock <= item.minStockLevel;
          return (
            <Card key={item.id} className={isLow ? "border-amber-300" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                      <p className="font-bold text-base truncate">{item.name}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {enableDualLedger && (
                        <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", item.isTaxLiability ? "border-green-300 text-green-700 bg-green-50" : "border-red-300 text-red-700 bg-red-50")}>
                          {item.isTaxLiability ? "Pakka" : "Kaccha"}
                        </Badge>
                      )}
                      {item.hsnCode && <span className="text-xs font-mono text-muted-foreground">HSN: {item.hsnCode}</span>}
                      <span className="text-xs text-muted-foreground">{item.unit}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0 text-sm font-semibold", isLow ? "text-amber-600 border-amber-300 bg-amber-50" : "")}>
                    {item.physicalStock} {item.unit}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/40 rounded p-2">
                    <p className="text-xs text-muted-foreground">Purchase Rate</p>
                    <p className="font-semibold">{formatCurrency(item.purchaseRate)}</p>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <p className="text-xs text-muted-foreground">Sale Rate</p>
                    <p className="font-semibold">{formatCurrency(item.saleRate)}</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t pt-3">
                  <Link href={`/inventory/items/${item.id}/edit`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                  </Link>
                  <Link href={`/inventory/items/${item.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full"><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                  </Link>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="md:hidden">
        <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Purchase Rate</TableHead>
                <TableHead className="text-right">Sale Rate</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No items found</TableCell></TableRow>
              ) : paginated.map((item: any) => {
                const isLow = item.physicalStock <= item.minStockLevel;
                return (
                  <TableRow key={item.id} className={cn(isLow && "bg-amber-50")}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isLow && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        {item.name}
                        {enableDualLedger && (
                          <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 ml-1", item.isTaxLiability ? "border-green-300 text-green-700 bg-green-50" : "border-red-300 text-red-700 bg-red-50")}>
                            {item.isTaxLiability ? "Pakka" : "Kaccha"}
                          </Badge>
                        )}
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
                        <Link href={`/inventory/items/${item.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                        <Link href={`/inventory/items/${item.id}`}><Button size="icon" variant="ghost" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button></Link>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>
      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
