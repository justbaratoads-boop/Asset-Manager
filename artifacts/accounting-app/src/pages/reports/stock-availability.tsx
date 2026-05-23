import { useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useFetch } from "@/hooks/use-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { cn } from "@/lib/utils";
import { formatQty } from "@/lib/format";
import { StockLedgerDialog } from "@/components/stock-ledger-dialog";

const PAGE_SIZE = 20;

const ALL_COLUMNS = [
  { header: "#", key: "idx" },
  { header: "Item", key: "name" },
  { header: "Unit", key: "unit" },
  { header: "Physical Stock", key: "physicalStock", format: (v: any) => String(Number(v)) },
  { header: "Reserved (Orders)", key: "reservedQty", format: (v: any) => String(Number(v)) },
  { header: "Available Stock", key: "availableStock", format: (v: any) => String(Number(v)) },
  { header: "Batch", key: "batchName" },
  { header: "Batch Avail", key: "batchAvail", format: (v: any) => String(Number(v)) },
  { header: "Status", key: "status" },
];

function availBadge(avail: number, minStock: number) {
  if (avail < 0) return <Badge variant="outline" className="bg-red-100 text-red-700 text-xs">Overbooked</Badge>;
  if (avail === 0) return <Badge variant="outline" className="bg-amber-100 text-amber-700 text-xs">Out of Stock</Badge>;
  if (avail <= minStock) return <Badge variant="outline" className="bg-amber-100 text-amber-700 text-xs">Low Stock</Badge>;
  return <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">Available</Badge>;
}

function getStatus(item: any): string {
  if (item.availableStock < 0) return "Overbooked";
  if (item.availableStock === 0) return "Out of Stock";
  if (item.availableStock <= item.minStockLevel) return "Low Stock";
  return "Available";
}

export default function StockAvailabilityReport() {
  const [page, setPage] = useState(1);
  const [ledgerItem, setLedgerItem] = useState<{ id: number; name: string } | null>(null);
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("stock-availability", ALL_COLUMNS);
  const vis = visibleKeys;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock-availability"],
    queryFn: () => customFetch<any[]>("/api/stock-availability"),
  });
  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");
  const batchByItemId = new Map<number, any>((batches as any[]).flatMap((b: any) => (b.items || []).map((i: any) => [i.id, b])));

  const list = items as any[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalPhysical = list.reduce((s: number, i: any) => s + i.physicalStock, 0);
  const totalReserved = list.reduce((s: number, i: any) => s + i.reservedQty, 0);
  const totalAvailable = list.reduce((s: number, i: any) => s + i.availableStock, 0);

  const exportData = list.map((item, idx) => {
    const batch = batchByItemId.get(item.id);
    return {
      ...item,
      idx: idx + 1,
      status: getStatus(item),
      batchName: batch?.name || "",
      batchAvail: batch ? Number(batch.physicalStock) - Number(batch.reservedStock) : "",
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Stock Availability Report</h1>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{list.length} items</p>
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          <ExportButtons data={exportData} columns={visibleColumns} filename="stock-availability" title="Stock Availability Report" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Total Physical Stock</p><p className="text-2xl font-bold">{totalPhysical.toLocaleString()}</p><p className="text-xs text-muted-foreground mt-1">Units in warehouse</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Reserved (Pending Orders)</p><p className="text-2xl font-bold text-amber-600">{totalReserved.toLocaleString()}</p><p className="text-xs text-muted-foreground mt-1">Ordered, not yet delivered</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Available Stock</p><p className={cn("text-2xl font-bold", totalAvailable < 0 ? "text-red-600" : "text-green-600")}>{totalAvailable.toLocaleString()}</p><p className="text-xs text-muted-foreground mt-1">Free to sell</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                {vis.has("idx") && <TableHead>#</TableHead>}
                {vis.has("name") && <TableHead>Item</TableHead>}
                {vis.has("unit") && <TableHead>Unit</TableHead>}
                {vis.has("physicalStock") && <TableHead className="text-right">Physical Stock</TableHead>}
                {vis.has("reservedQty") && <TableHead className="text-right">Reserved (Orders)</TableHead>}
                {vis.has("availableStock") && <TableHead className="text-right">Available Stock</TableHead>}
                {vis.has("batchName") && <TableHead>Batch</TableHead>}
                {vis.has("batchAvail") && <TableHead className="text-right">Batch Avail</TableHead>}
                {vis.has("status") && <TableHead>Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground py-8">No stock items found</TableCell></TableRow>
              ) : paginated.map((item: any, idx: number) => (
                <TableRow
                  key={item.id}
                  className={cn("cursor-pointer hover:bg-muted/50", item.availableStock < 0 && "bg-red-50", item.availableStock === 0 && "bg-amber-50")}
                  onClick={() => setLedgerItem({ id: item.id, name: item.name })}
                >
                  {vis.has("idx") && <TableCell className="text-xs text-muted-foreground">{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>}
                  {vis.has("name") && <TableCell className="font-medium">{item.name}</TableCell>}
                  {vis.has("unit") && <TableCell className="text-sm">{item.unit}</TableCell>}
                  {vis.has("physicalStock") && <TableCell className="text-right font-medium">{formatQty(item.physicalStock, item.unit)}</TableCell>}
                  {vis.has("reservedQty") && (
                    <TableCell className="text-right">
                      {item.reservedQty > 0 ? <span className="text-amber-700 font-medium">{formatQty(item.reservedQty, item.unit)}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {vis.has("availableStock") && (
                    <TableCell className="text-right font-bold">
                      <span className={cn(item.availableStock < 0 ? "text-red-600" : item.availableStock === 0 ? "text-amber-600" : "text-green-700")}>
                        {formatQty(item.availableStock, item.unit)}
                      </span>
                    </TableCell>
                  )}
                  {vis.has("batchName") && (() => {
                    const batch = batchByItemId.get(item.id);
                    return (
                      <TableCell className="text-xs">
                        {batch ? <span className="font-medium">{batch.name}</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    );
                  })()}
                  {vis.has("batchAvail") && (() => {
                    const batch = batchByItemId.get(item.id);
                    if (!batch) return <TableCell className="text-right text-muted-foreground">—</TableCell>;
                    const avail = Number(batch.physicalStock) - Number(batch.reservedStock);
                    return (
                      <TableCell className="text-right font-medium">
                        <span className={cn(avail <= 0 ? "text-amber-600" : "text-green-700")}>{formatQty(avail, item.unit)}</span>
                      </TableCell>
                    );
                  })()}
                  {vis.has("status") && <TableCell>{availBadge(item.availableStock, item.minStockLevel)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1 px-1">
        <p><span className="font-medium">Physical Stock</span> — actual units present in your warehouse.</p>
        <p><span className="font-medium">Reserved</span> — quantity committed to pending sale orders not yet delivered or invoiced.</p>
        <p><span className="font-medium">Available Stock</span> — physical stock minus reserved. Negative means you have over-promised.</p>
      </div>

      <StockLedgerDialog item={ledgerItem} onClose={() => setLedgerItem(null)} />
    </div>
  );
}
