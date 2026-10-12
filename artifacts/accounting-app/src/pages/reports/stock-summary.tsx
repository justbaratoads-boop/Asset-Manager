import { useState } from "react";
import { useGetStockSummary } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatQty } from "@/lib/format";
import { ReportActions } from "@/components/report-actions";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useReportSort } from "@/hooks/use-report-sort";
import { useFY } from "@/lib/financial-year";
import { StockLedgerDialog } from "@/components/stock-ledger-dialog";
import { MobileReportRow } from "@/components/mobile-report-row";
import { X } from "lucide-react";

const ALL_COLUMNS = [
  { header: "Item", key: "name" },
  { header: "Unit", key: "unit" },
  { header: "HSN Code", key: "hsnCode" },
  { header: "Opening Qty", key: "openingQty", format: (v: any) => Number(v).toFixed(2) },
  { header: "Opening Value", key: "openingValue", format: (v: any) => Number(v).toFixed(2) },
  { header: "Purchased Qty", key: "purchasedQty", format: (v: any) => Number(v).toFixed(2) },
  { header: "Purchase Value", key: "purchasedValue", format: (v: any) => Number(v).toFixed(2) },
  { header: "Sale Return Qty", key: "saleReturnQty", format: (v: any) => Number(v).toFixed(2) },
  { header: "Sale Return Value", key: "saleReturnValue", format: (v: any) => Number(v).toFixed(2) },
  { header: "Sold Qty", key: "soldQty", format: (v: any) => Number(v).toFixed(2) },
  { header: "Sale Value", key: "soldValue", format: (v: any) => Number(v).toFixed(2) },
  { header: "Purchase Return Qty", key: "purchaseReturnQty", format: (v: any) => Number(v).toFixed(2) },
  { header: "Purchase Return Value", key: "purchaseReturnValue", format: (v: any) => Number(v).toFixed(2) },
  { header: "Closing Qty", key: "closingQty", format: (v: any) => Number(v).toFixed(2) },
  { header: "Closing Value", key: "closingValue", format: (v: any) => Number(v).toFixed(2) },
];

const DEFAULT_VISIBLE = ["name","unit","hsnCode","openingQty","openingValue","purchasedQty","purchasedValue","soldQty","soldValue","closingQty","closingValue"];

export default function StockSummary() {
  const { fy, globalFrom: from, globalTo: to, setGlobalFrom, setGlobalTo, clearGlobalDates } = useFY();
  
  const [ledgerItem, setLedgerItem] = useState<{ id: number; name: string } | null>(null);
  const { data, isLoading } = useGetStockSummary({ from, to });
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("stock-summary", ALL_COLUMNS, DEFAULT_VISIBLE);

  const summary: any[] = (data as any)?.summary || [];
  const { sortedData, sortKey, sortDir, setSortKey, setSortDir, toggleSort } = useReportSort(summary, "name", "asc");
  const vis = visibleKeys;

  const totalClosingValue = summary.reduce((s: number, i: any) => s + (i.closingValue || 0), 0);
  const totalPurchasedValue = summary.reduce((s: number, i: any) => s + (i.purchasedValue || 0), 0);
  const totalSoldValue = summary.reduce((s: number, i: any) => s + (i.soldValue || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Stock Summary</h1>
        <div className="flex items-center gap-2">
          <ReportActions
            allColumns={allColumns}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={(k, d) => { setSortKey(k); setSortDir(d); }}
            onResetSort={() => { setSortKey(""); setSortDir(null); }}
            visibleKeys={vis}
            onToggleColumn={toggle}
            onSelectAllColumns={() => setAll(true)}
            onClearAllColumns={() => setAll(false)}
            data={sortedData}
            visibleColumns={visibleColumns}
            filename={`stock-summary-${from}-${to}`}
            title="Stock Summary"
            shareSummary={`Closing Stock Value: ${formatCurrency(totalClosingValue)}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-card border rounded-lg p-1.5 shadow-sm">
          <Label className="text-xs text-muted-foreground ml-1">From</Label>
          <Input
            type="date"
            value={from || ""}
            onChange={(e) => setGlobalFrom(e.target.value)}
            className="h-8 w-34 text-xs"
            title="From Date"
          />
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            value={to || ""}
            onChange={(e) => setGlobalTo(e.target.value)}
            className="h-8 w-34 text-xs"
            title="To Date"
          />
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearGlobalDates}
              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
              title="Clear date filter"
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Purchase Value</p><p className="text-xl font-bold">{formatCurrency(totalPurchasedValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Sale Value</p><p className="text-xl font-bold">{formatCurrency(totalSoldValue)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Closing Stock Value</p><p className="text-xl font-bold text-primary">{formatCurrency(totalClosingValue)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Mobile view (< md): Zero horizontal scroll cards */}
          <div className="md:hidden divide-y divide-border/60">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : !sortedData.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No stock items found</div>
            ) : (
              <>
                {sortedData.map((item: any) => {
                  const closingQtyNum = Number(item.closingQty);
                  return (
                    <MobileReportRow
                      key={item.id}
                      onClick={() => setLedgerItem({ id: item.id, name: item.name })}
                      primaryTitle={item.name}
                      subtitle={
                        <span>
                          {item.unit && <span>Unit: {item.unit}</span>}
                          {item.hsnCode && <span className="ml-1.5">• HSN: {item.hsnCode}</span>}
                        </span>
                      }
                      middlePrimary={
                        <div className="text-[11px] space-y-0.5">
                          {Number(item.purchasedQty) > 0 && <span className="text-blue-600 block">In: {formatQty(item.purchasedQty, item.unit)}</span>}
                          {Number(item.soldQty) > 0 && <span className="text-green-600 block">Out: {formatQty(item.soldQty, item.unit)}</span>}
                          {Number(item.purchasedQty) === 0 && Number(item.soldQty) === 0 && <span className="text-muted-foreground">No movement</span>}
                        </div>
                      }
                      amount={item.closingValue}
                      amountLabel="Value"
                      customRight={
                        <div>
                          <div className="flex items-center justify-end gap-1 font-bold text-sm">
                            <span>{formatQty(item.closingQty, item.unit)}</span>
                            {closingQtyNum <= 0 && <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 py-0 px-1 h-4">Out</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Val: {formatCurrency(Number(item.closingValue))}
                          </p>
                        </div>
                      }
                    />
                  );
                })}
                {summary.length > 0 && (
                  <div className="p-3 bg-muted/30 flex items-center justify-between text-sm font-semibold">
                    <span>Total Closing Stock Value</span>
                    <span className="font-bold text-foreground">{formatCurrency(totalClosingValue)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Desktop view (>= md): Full Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {vis.has("name") && <TableHead>Item</TableHead>}
                  {vis.has("unit") && <TableHead>Unit</TableHead>}
                  {vis.has("hsnCode") && <TableHead>HSN</TableHead>}
                  {vis.has("openingQty") && <TableHead className="text-right">Open Qty</TableHead>}
                  {vis.has("openingValue") && <TableHead className="text-right">Open Value</TableHead>}
                  {vis.has("purchasedQty") && <TableHead className="text-right">Purchased Qty</TableHead>}
                  {vis.has("purchasedValue") && <TableHead className="text-right">Purchase Value</TableHead>}
                  {vis.has("saleReturnQty") && <TableHead className="text-right">Sale Return Qty</TableHead>}
                  {vis.has("saleReturnValue") && <TableHead className="text-right">Sale Return Value</TableHead>}
                  {vis.has("soldQty") && <TableHead className="text-right">Sold Qty</TableHead>}
                  {vis.has("soldValue") && <TableHead className="text-right">Sale Value</TableHead>}
                  {vis.has("purchaseReturnQty") && <TableHead className="text-right">Purch. Return Qty</TableHead>}
                  {vis.has("purchaseReturnValue") && <TableHead className="text-right">Purch. Return Value</TableHead>}
                  {vis.has("closingQty") && <TableHead className="text-right font-bold">Close Qty</TableHead>}
                  {vis.has("closingValue") && <TableHead className="text-right font-bold">Close Value</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  : !sortedData.length
                    ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">No stock items found</TableCell></TableRow>
                    : sortedData.map((item: any) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLedgerItem({ id: item.id, name: item.name })}
                      >
                        {vis.has("name") && <TableCell className="font-medium max-w-[160px] truncate">{item.name}</TableCell>}
                        {vis.has("unit") && <TableCell className="text-xs">{item.unit}</TableCell>}
                        {vis.has("hsnCode") && <TableCell className="text-xs text-muted-foreground">{item.hsnCode || "-"}</TableCell>}
                        {vis.has("openingQty") && <TableCell className="text-right text-sm">{formatQty(item.openingQty, item.unit)}</TableCell>}
                        {vis.has("openingValue") && <TableCell className="text-right text-sm">{formatCurrency(Number(item.openingValue))}</TableCell>}
                        {vis.has("purchasedQty") && <TableCell className="text-right text-sm text-blue-600">{formatQty(item.purchasedQty, item.unit)}</TableCell>}
                        {vis.has("purchasedValue") && <TableCell className="text-right text-sm">{formatCurrency(Number(item.purchasedValue))}</TableCell>}
                        {vis.has("saleReturnQty") && <TableCell className="text-right text-sm text-orange-600">{formatQty(item.saleReturnQty, item.unit)}</TableCell>}
                        {vis.has("saleReturnValue") && <TableCell className="text-right text-sm">{formatCurrency(Number(item.saleReturnValue))}</TableCell>}
                        {vis.has("soldQty") && <TableCell className="text-right text-sm text-green-600">{formatQty(item.soldQty, item.unit)}</TableCell>}
                        {vis.has("soldValue") && <TableCell className="text-right text-sm">{formatCurrency(Number(item.soldValue))}</TableCell>}
                        {vis.has("purchaseReturnQty") && <TableCell className="text-right text-sm text-pink-600">{formatQty(item.purchaseReturnQty, item.unit)}</TableCell>}
                        {vis.has("purchaseReturnValue") && <TableCell className="text-right text-sm">{formatCurrency(Number(item.purchaseReturnValue))}</TableCell>}
                        {vis.has("closingQty") && (
                          <TableCell className="text-right font-semibold">
                            <div className="flex items-center justify-end gap-1">
                              {formatQty(item.closingQty, item.unit)}
                              {Number(item.closingQty) <= 0 && <Badge variant="outline" className="text-xs text-red-600 border-red-300">Out</Badge>}
                            </div>
                          </TableCell>
                        )}
                        {vis.has("closingValue") && <TableCell className="text-right font-semibold">{formatCurrency(Number(item.closingValue))}</TableCell>}
                      </TableRow>
                    ))
                }
                {summary.length > 0 && (
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={visibleColumns.filter(c => c.key !== "closingValue").length}>Total</TableCell>
                    {vis.has("closingValue") && <TableCell className="text-right">{formatCurrency(totalClosingValue)}</TableCell>}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <StockLedgerDialog item={ledgerItem} onClose={() => setLedgerItem(null)} />
    </div>
  );
}


