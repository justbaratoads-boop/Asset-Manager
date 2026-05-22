import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { useFY } from "@/lib/financial-year";
import { useFetch } from "@/hooks/use-fetch";
import { Layers } from "lucide-react";

interface BatchRow {
  batchId: number | null;
  batchName: string | null;
  expiryDate: string | null;
  openingQty: number;
  openingRate: number;
  openingValue: number;
  inwardQty: number;
  inwardRate: number;
  inwardValue: number;
  outwardQty: number;
  outwardRate: number;
  outwardValue: number;
  closingQty: number;
  closingRate: number;
  closingValue: number;
}

interface ItemGroup {
  itemId: number;
  itemName: string;
  unit: string;
  hsnCode?: string;
  rows: BatchRow[];
}

const fmt2 = (n: number) => Number(n || 0).toFixed(2);
const fmtRate = (n: number) => n > 0 ? `₹${Number(n).toFixed(2)}` : "—";

export default function StockSummaryBatch() {
  const { fy } = useFY();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);

  const { data, isLoading } = useFetch<{ items: ItemGroup[] }>(
    `/api/reports/stock-summary-batch?from=${from || ""}&to=${to || ""}`
  );

  const items: ItemGroup[] = data?.items || [];
  const totalClosingValue = items.reduce((s, item) =>
    s + item.rows.reduce((rs, r) => rs + r.closingValue, 0), 0
  );
  const totalInwardValue = items.reduce((s, item) =>
    s + item.rows.reduce((rs, r) => rs + r.inwardValue, 0), 0
  );
  const totalOutwardValue = items.reduce((s, item) =>
    s + item.rows.reduce((rs, r) => rs + r.outwardValue, 0), 0
  );

  // Flatten for export
  const exportRows = items.flatMap(item =>
    item.rows.map(r => ({
      "Item": item.itemName,
      "Unit": item.unit,
      "Batch": r.batchName || "(Main Stock)",
      "Expiry": r.expiryDate || "",
      "Open Qty": fmt2(r.openingQty),
      "Open Rate": fmt2(r.openingRate),
      "Open Value": fmt2(r.openingValue),
      "Inward Qty": fmt2(r.inwardQty),
      "Inward Rate": fmt2(r.inwardRate),
      "Inward Value": fmt2(r.inwardValue),
      "Outward Qty": fmt2(r.outwardQty),
      "Outward Rate": fmt2(r.outwardRate),
      "Outward Value": fmt2(r.outwardValue),
      "Closing Qty": fmt2(r.closingQty),
      "Closing Rate": fmt2(r.closingRate),
      "Closing Value": fmt2(r.closingValue),
    }))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Batch-wise Stock Summary</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Average cost valuation · {items.length} items</p>
        </div>
        <ExportButtons
          data={exportRows}
          columns={Object.keys(exportRows[0] || {}).map(k => ({ key: k, header: k }))}
          filename={`batch-stock-summary-${from}-${to}`}
          title="Batch-wise Stock Summary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
        <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Inward Value</p><p className="text-xl font-bold text-blue-600">{formatCurrency(totalInwardValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Outward Value</p><p className="text-xl font-bold text-green-600">{formatCurrency(totalOutwardValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Closing Stock Value</p><p className="text-xl font-bold text-primary">{formatCurrency(totalClosingValue)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-40 min-w-[160px]">Stock Item</TableHead>
                <TableHead className="min-w-[120px]">Batch</TableHead>
                <TableHead className="text-right min-w-[72px]">Open Qty</TableHead>
                <TableHead className="text-right min-w-[80px]">Open Rate</TableHead>
                <TableHead className="text-right min-w-[90px]">Open Value</TableHead>
                <TableHead className="text-right min-w-[72px]">In Qty</TableHead>
                <TableHead className="text-right min-w-[80px]">In Rate</TableHead>
                <TableHead className="text-right min-w-[90px]">In Value</TableHead>
                <TableHead className="text-right min-w-[72px]">Out Qty</TableHead>
                <TableHead className="text-right min-w-[80px]">Out Rate</TableHead>
                <TableHead className="text-right min-w-[90px]">Out Value</TableHead>
                <TableHead className="text-right min-w-[72px] font-bold">Close Qty</TableHead>
                <TableHead className="text-right min-w-[80px] font-bold">Close Rate</TableHead>
                <TableHead className="text-right min-w-[90px] font-bold">Close Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={14} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={14} className="text-center py-10 text-muted-foreground">No stock items found</TableCell></TableRow>
              ) : (
                items.map(item => {
                  const isBatched = item.rows.length > 1 || (item.rows.length === 1 && item.rows[0].batchId !== null);
                  return item.rows.map((row, ri) => {
                    const isFirst = ri === 0;
                    return (
                      <TableRow
                        key={`${item.itemId}-${row.batchId ?? "main"}`}
                        className={
                          isBatched && row.batchId !== null
                            ? "bg-muted/30"
                            : isBatched && row.batchId === null
                              ? "bg-blue-50/40"
                              : ""
                        }
                      >
                        {/* Item name — only on first row for batched items */}
                        <TableCell className="font-medium text-sm max-w-[160px]">
                          {isFirst ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate">{item.itemName}</span>
                              {item.unit && <span className="text-[10px] text-muted-foreground">{item.unit}</span>}
                            </div>
                          ) : null}
                        </TableCell>

                        {/* Batch name */}
                        <TableCell className="text-sm">
                          {row.batchId !== null ? (
                            <div className="flex flex-col gap-0.5 pl-3">
                              <span className="font-medium flex items-center gap-1">
                                <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                                {row.batchName}
                              </span>
                              {row.expiryDate && (
                                <span className="text-[10px] text-muted-foreground">Exp: {row.expiryDate}</span>
                              )}
                            </div>
                          ) : (
                            isBatched
                              ? <span className="text-xs text-muted-foreground pl-3 italic">Main (unbatched)</span>
                              : <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Opening */}
                        <TableCell className="text-right text-sm">{fmt2(row.openingQty)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{fmtRate(row.openingRate)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.openingValue)}</TableCell>

                        {/* Inward */}
                        <TableCell className="text-right text-sm text-blue-700">{row.inwardQty > 0 ? fmt2(row.inwardQty) : "—"}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{fmtRate(row.inwardRate)}</TableCell>
                        <TableCell className="text-right text-sm text-blue-700">{row.inwardValue > 0 ? formatCurrency(row.inwardValue) : "—"}</TableCell>

                        {/* Outward */}
                        <TableCell className="text-right text-sm text-green-700">{row.outwardQty > 0 ? fmt2(row.outwardQty) : "—"}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{fmtRate(row.outwardRate)}</TableCell>
                        <TableCell className="text-right text-sm text-green-700">{row.outwardValue > 0 ? formatCurrency(row.outwardValue) : "—"}</TableCell>

                        {/* Closing */}
                        <TableCell className="text-right font-semibold">
                          <div className="flex items-center justify-end gap-1">
                            {fmt2(row.closingQty)}
                            {row.closingQty <= 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-red-300 text-red-600">Out</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmtRate(row.closingRate)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(row.closingValue)}</TableCell>
                      </TableRow>
                    );
                  });
                })
              )}

              {/* Totals row */}
              {!isLoading && items.length > 0 && (
                <TableRow className="font-bold bg-muted/30 border-t-2">
                  <TableCell colSpan={10}>Total</TableCell>
                  <TableCell className="text-right text-green-700">{formatCurrency(totalOutwardValue)}</TableCell>
                  <TableCell />
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
