import { useGetCashBook } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { ReportActions } from "@/components/report-actions";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useReportSort } from "@/hooks/use-report-sort";
import { useFY } from "@/lib/financial-year";
import { useLocation } from "wouter";
import { X, Wallet } from "lucide-react";

const ALL_COLUMNS = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Description", key: "description" },
  { header: "Ref#", key: "ref" },
  { header: "Party", key: "party" },
  { header: "Cash In", key: "cashIn", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
  { header: "Cash Out", key: "cashOut", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
  { header: "Balance", key: "balance", format: (v: any) => String(Number(v).toFixed(2)) },
];

export default function CashBook() {
  const { globalFrom, globalTo, setGlobalFrom, setGlobalTo, clearGlobalDates } = useFY();
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetCashBook({ from: globalFrom, to: globalTo });
  const entries: any[] = (data as any)?.entries || [];
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("cash-book", ALL_COLUMNS);
  const { sortedData, sortKey, sortDir, setSortKey, setSortDir, toggleSort } = useReportSort(entries, "date", "desc");
  const vis = visibleKeys;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Cash Book
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track daily cash receipts, payments, and running balance</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-card border rounded-lg p-1.5 shadow-sm">
            <Label className="text-xs text-muted-foreground ml-1">From</Label>
            <Input
              type="date"
              value={globalFrom || ""}
              onChange={(e) => setGlobalFrom(e.target.value)}
              className="h-8 w-34 text-xs"
              title="From Date (Saved automatically)"
            />
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={globalTo || ""}
              onChange={(e) => setGlobalTo(e.target.value)}
              className="h-8 w-34 text-xs"
              title="To Date (Saved automatically)"
            />
            {(globalFrom || globalTo) && (
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
            filename={`cash-book-${globalFrom || "all"}-${globalTo || "all"}`}
            title="Cash Book"
            shareSummary={`Cash In: ${formatCurrency((data as any)?.totalIn || 0)}, Cash Out: ${formatCurrency((data as any)?.totalOut || 0)}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Cash In</p><p className="text-xl font-bold text-green-600">{formatCurrency((data as any)?.totalIn)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Cash Out</p><p className="text-xl font-bold text-red-600">{formatCurrency((data as any)?.totalOut)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                {vis.has("date") && <TableHead>Date</TableHead>}
                {vis.has("description") && <TableHead>Description</TableHead>}
                {vis.has("ref") && <TableHead>Ref#</TableHead>}
                {vis.has("party") && <TableHead>Party</TableHead>}
                {vis.has("cashIn") && <TableHead className="text-right">Cash In</TableHead>}
                {vis.has("cashOut") && <TableHead className="text-right">Cash Out</TableHead>}
                {vis.has("balance") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("balance")}>Balance {sortKey === "balance" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : !sortedData.length ? (
                <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">No cash entries for selected period</TableCell></TableRow>
              ) : (
                entries.map((e: any, i: number) => {
                  const destPath = e.id
                    ? e.type === "payment" ? `/accounts/payments/${e.id}/edit`
                    : e.type === "receipt" ? `/accounts/receipts/${e.id}/edit`
                    : e.type === "sale-invoice" ? `/sales/invoices/${e.id}`
                    : e.type === "purchase-invoice" ? `/purchase/invoices/${e.id}/edit`
                    : null
                    : null;
                  return (
                    <TableRow
                      key={i}
                      className={destPath ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => { if (destPath) setLocation(destPath); }}
                    >
                      {vis.has("date") && <TableCell className="text-sm">{formatDate(e.date)}</TableCell>}
                      {vis.has("description") && <TableCell className="max-w-xs truncate">{e.description || "-"}</TableCell>}
                      {vis.has("ref") && <TableCell className="font-mono text-xs">{e.ref}</TableCell>}
                      {vis.has("party") && <TableCell className="text-sm">{e.party || "-"}</TableCell>}
                      {vis.has("cashIn") && <TableCell className="text-right text-green-600">{e.cashIn > 0 ? formatCurrency(e.cashIn) : ""}</TableCell>}
                      {vis.has("cashOut") && <TableCell className="text-right text-red-600">{e.cashOut > 0 ? formatCurrency(e.cashOut) : ""}</TableCell>}
                      {vis.has("balance") && <TableCell className={`text-right font-medium ${e.balance < 0 ? "text-red-600" : ""}`}>{formatCurrency(e.balance)}</TableCell>}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
