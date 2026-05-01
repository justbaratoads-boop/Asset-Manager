import { useState } from "react";
import { useGetStockSummary } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { useFY } from "@/lib/financial-year";

const columns = [
  { header: "Item", key: "name" },
  { header: "Unit", key: "unit" },
  { header: "HSN Code", key: "hsnCode" },
  { header: "Opening Qty", key: "openingQty", format: (v: any) => String(Number(v)) },
  { header: "Opening Value", key: "openingValue", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Purchased Qty", key: "purchasedQty", format: (v: any) => String(Number(v)) },
  { header: "Purchase Value", key: "purchasedValue", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Sold Qty", key: "soldQty", format: (v: any) => String(Number(v)) },
  { header: "Sale Value", key: "soldValue", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Closing Qty", key: "closingQty", format: (v: any) => String(Number(v)) },
  { header: "Closing Value", key: "closingValue", format: (v: any) => String(Number(v).toFixed(2)) },
];

export default function StockSummary() {
  const { fy } = useFY();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const { data, isLoading } = useGetStockSummary({ from: from || undefined, to: to || undefined });

  const summary: any[] = (data as any)?.summary || [];
  const totalClosingValue = summary.reduce((s: number, i: any) => s + (i.closingValue || 0), 0);
  const totalPurchasedValue = summary.reduce((s: number, i: any) => s + (i.purchasedValue || 0), 0);
  const totalSoldValue = summary.reduce((s: number, i: any) => s + (i.soldValue || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Stock Summary</h1>
        <ExportButtons data={summary} columns={columns} filename={`stock-summary-${from}-${to}`} title="Stock Summary" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
        <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Purchase Value</p><p className="text-xl font-bold">{formatCurrency(totalPurchasedValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Sale Value</p><p className="text-xl font-bold">{formatCurrency(totalSoldValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Closing Stock Value</p><p className="text-xl font-bold text-primary">{formatCurrency(totalClosingValue)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead><TableHead>Unit</TableHead><TableHead>HSN</TableHead>
                <TableHead className="text-right">Open Qty</TableHead><TableHead className="text-right">Open Value</TableHead>
                <TableHead className="text-right">Purchased Qty</TableHead><TableHead className="text-right">Purchase Value</TableHead>
                <TableHead className="text-right">Sold Qty</TableHead><TableHead className="text-right">Sale Value</TableHead>
                <TableHead className="text-right font-bold">Close Qty</TableHead><TableHead className="text-right font-bold">Close Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                : !summary.length
                  ? <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No stock items found</TableCell></TableRow>
                  : summary.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-[160px] truncate">{item.name}</TableCell>
                      <TableCell className="text-xs">{item.unit}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.hsnCode || "-"}</TableCell>
                      <TableCell className="text-right text-sm">{Number(item.openingQty).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(item.openingValue)}</TableCell>
                      <TableCell className="text-right text-sm text-blue-600">{Number(item.purchasedQty).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(item.purchasedValue)}</TableCell>
                      <TableCell className="text-right text-sm text-green-600">{Number(item.soldQty).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(item.soldValue)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        <div className="flex items-center justify-end gap-1">
                          {Number(item.closingQty).toFixed(2)}
                          {item.closingQty <= 0 && <Badge variant="outline" className="text-xs text-red-600 border-red-300">Out</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.closingValue)}</TableCell>
                    </TableRow>
                  ))
              }
              {summary.length > 0 && (
                <TableRow className="font-bold bg-muted/30">
                  <TableCell colSpan={9}>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{formatCurrency(totalClosingValue)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
