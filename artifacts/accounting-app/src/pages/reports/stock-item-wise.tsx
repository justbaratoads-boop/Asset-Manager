import { useState } from "react";
import { useListStockItems, useGetStockItem } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useFY } from "@/lib/financial-year";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const ALL_COLUMNS = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Type", key: "type", format: (v: string) => v.replace("-", " ").toUpperCase() },
  { header: "Ref", key: "ref" },
  { header: "Batch", key: "batchId" },
  { header: "In (Qty)", key: "inQty" },
  { header: "Out (Qty)", key: "outQty" },
  { header: "Balance", key: "balance" },
];

export default function StockReportItemWise() {
  const { fy, globalFrom: from, globalTo: to } = useFY();
  
  
  const [itemId, setItemId] = useState<string>("");

  const { data: items = [] } = useListStockItems();
  const { data: itemData, isLoading } = useGetStockItem(Number(itemId), { query: { enabled: !!itemId } });

  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("stock-item-wise", ALL_COLUMNS);
  const vis = visibleKeys;

  // Filter transactions by date range on the client side since the API returns all for this item
  const allTransactions = itemData?.transactions || [];
  const transactions = allTransactions.filter(t => {
    if (from && t.createdAt.slice(0, 10) < from) return false;
    if (to && t.createdAt.slice(0, 10) > to) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Stock Item-Wise Report</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Stock Item" />
              </SelectTrigger>
              <SelectContent>
                {items.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          <ExportButtons data={transactions} columns={visibleColumns} filename={`stock-item-${itemId}-${from}-${to}`} title="Stock Report Item Wise" />
        </div>
      </div>
      
      {itemData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Item</p><p className="font-medium truncate">{itemData.name}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Current Stock</p><p className="font-bold text-lg">{itemData.currentStock} {itemData.unit}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Base Price</p><p className="font-medium">{formatCurrency(itemData.purchasePrice)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sales Price</p><p className="font-medium">{formatCurrency(itemData.salesPrice)}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {!itemId ? (
            <div className="py-10 text-center text-muted-foreground">
              Please select a stock item to view its report.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {vis.has("date") && <TableHead>Date</TableHead>}
                  {vis.has("type") && <TableHead>Type</TableHead>}
                  {vis.has("ref") && <TableHead>Ref#</TableHead>}
                  {vis.has("batchId") && <TableHead>Batch ID</TableHead>}
                  {vis.has("inQty") && <TableHead className="text-right">In</TableHead>}
                  {vis.has("outQty") && <TableHead className="text-right">Out</TableHead>}
                  {vis.has("balance") && <TableHead className="text-right">Balance</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                  : !transactions.length
                    ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">No transactions found</TableCell></TableRow>
                    : transactions.map((t: any, i: number) => {
                      const qty = Number(t.quantity);
                      const isSale = t.type === "sale" || t.type === "production-out" || t.type === "delivery" || t.type === "credit-note"; // wait, credit note is in.
                      const isPurchase = t.type === "purchase" || t.type === "opening" || t.type === "production-in" || t.type === "purchase-order"; // purchase order is not actual stock?
                      const outVal = (t.type === "sale" || t.type === "delivery" || t.type === "purchase-return") ? Math.abs(qty) : "";
                      const inVal = (t.type === "purchase" || t.type === "opening" || t.type === "sale-return") ? Math.abs(qty) : "";

                      return (
                        <TableRow key={t.id || i}>
                          {vis.has("date") && <TableCell className="text-sm">{formatDate(t.createdAt)}</TableCell>}
                          {vis.has("type") && <TableCell><Badge variant="outline" className="uppercase text-[10px]">{t.type.replace("-", " ")}</Badge></TableCell>}
                          {vis.has("ref") && <TableCell className="font-mono text-xs">{t.reference || "-"}</TableCell>}
                          {vis.has("batchId") && <TableCell className="text-sm">{t.batchId || "-"}</TableCell>}
                          {vis.has("inQty") && <TableCell className="text-right text-green-600 font-medium">{inVal}</TableCell>}
                          {vis.has("outQty") && <TableCell className="text-right text-red-600 font-medium">{outVal}</TableCell>}
                          {vis.has("balance") && <TableCell className="text-right font-bold">{t.balanceAfter}</TableCell>}
                        </TableRow>
                      );
                    })
                }
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


