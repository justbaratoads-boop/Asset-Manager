import { useState } from "react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function availBadge(avail: number, minStock: number) {
  if (avail < 0)
    return <Badge variant="outline" className="bg-red-100 text-red-700 text-xs">Overbooked</Badge>;
  if (avail === 0)
    return <Badge variant="outline" className="bg-amber-100 text-amber-700 text-xs">Out of Stock</Badge>;
  if (avail <= minStock)
    return <Badge variant="outline" className="bg-amber-100 text-amber-700 text-xs">Low Stock</Badge>;
  return <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">Available</Badge>;
}

export default function StockAvailabilityReport() {
  const [page, setPage] = useState(1);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["stock-availability"],
    queryFn: () => customFetch<any[]>("/api/stock-availability"),
  });

  const list = items as any[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalPhysical = list.reduce((s: number, i: any) => s + i.physicalStock, 0);
  const totalReserved = list.reduce((s: number, i: any) => s + i.reservedQty, 0);
  const totalAvailable = list.reduce((s: number, i: any) => s + i.availableStock, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Stock Availability Report</h1>
        <p className="text-xs text-muted-foreground">{list.length} items</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Physical Stock</p>
            <p className="text-2xl font-bold">{totalPhysical.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Units in warehouse</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Reserved (Pending Orders)</p>
            <p className="text-2xl font-bold text-amber-600">{totalReserved.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Ordered, not yet delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Available Stock</p>
            <p className={cn("text-2xl font-bold", totalAvailable < 0 ? "text-red-600" : "text-green-600")}>{totalAvailable.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Free to sell</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Physical Stock</TableHead>
                <TableHead className="text-right">Reserved (Orders)</TableHead>
                <TableHead className="text-right">Available Stock</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No stock items found</TableCell></TableRow>
              ) : paginated.map((item: any, idx: number) => (
                <TableRow key={item.id} className={cn(item.availableStock < 0 && "bg-red-50", item.availableStock === 0 && "bg-amber-50")}>
                  <TableCell className="text-xs text-muted-foreground">{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-sm">{item.unit}</TableCell>
                  <TableCell className="text-right font-medium">{Number(item.physicalStock).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {item.reservedQty > 0 ? (
                      <span className="text-amber-700 font-medium">{Number(item.reservedQty).toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    <span className={cn(
                      item.availableStock < 0 ? "text-red-600" :
                      item.availableStock === 0 ? "text-amber-600" :
                      "text-green-700"
                    )}>
                      {Number(item.availableStock).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>{availBadge(item.availableStock, item.minStockLevel)}</TableCell>
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
    </div>
  );
}
