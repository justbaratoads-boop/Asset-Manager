// @ts-nocheck
import { useGetTrialBalance } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ReportActions } from "@/components/report-actions";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useReportSort } from "@/hooks/use-report-sort";

const groupColors: Record<string, string> = {
  assets: "bg-blue-100 text-blue-700",
  liabilities: "bg-red-100 text-red-700",
  income: "bg-green-100 text-green-700",
  expense: "bg-orange-100 text-orange-700",
  capital: "bg-purple-100 text-purple-700",
};

const ALL_COLUMNS = [
  { header: "Ledger", key: "name" },
  { header: "Group", key: "group" },
  { header: "Nature", key: "nature" },
  { header: "Opening Balance", key: "openingBalance", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Debit", key: "debit", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Credit", key: "credit", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Closing Balance", key: "closing", format: (v: any) => String(Number(v).toFixed(2)) },
];

export default function TrialBalance() {
  const { data, isLoading } = useGetTrialBalance({});
  const rows: any[] = (data as any)?.rows || [];
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("trial-balance", ALL_COLUMNS);
  const { sortedData, sortKey, sortDir, setSortKey, setSortDir, toggleSort } = useReportSort(rows, "name", "asc");
  const vis = visibleKeys;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Trial Balance</h1>
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
          filename="trial-balance"
          title="Trial Balance"
          shareSummary={`Total Debit: ${formatCurrency((data as any)?.totalDebit || 0)}, Total Credit: ${formatCurrency((data as any)?.totalCredit || 0)}`}
        />
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                {vis.has("name") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>Ledger {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("group") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("group")}>Group {sortKey === "group" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("nature") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("nature")}>Nature {sortKey === "nature" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("openingBalance") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("openingBalance")}>Opening {sortKey === "openingBalance" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("debit") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("debit")}>Debit {sortKey === "debit" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("credit") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("credit")}>Credit {sortKey === "credit" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("closing") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("closing")}>Balance {sortKey === "closing" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !sortedData.length
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">No ledger data</TableCell></TableRow>
                  : sortedData.map((r: any) => (

                    <TableRow key={r.id}>
                      {vis.has("name") && <TableCell className="font-medium">{r.name}</TableCell>}
                      {vis.has("group") && <TableCell><Badge variant="outline" className={`text-xs capitalize ${groupColors[r.group] || ""}`}>{r.group}</Badge></TableCell>}
                      {vis.has("nature") && <TableCell className="text-xs capitalize">{r.nature}</TableCell>}
                      {vis.has("openingBalance") && <TableCell className="text-right text-sm">{formatCurrency(r.openingBalance)}</TableCell>}
                      {vis.has("debit") && <TableCell className="text-right">{r.debit > 0 ? formatCurrency(r.debit) : ""}</TableCell>}
                      {vis.has("credit") && <TableCell className="text-right">{r.credit > 0 ? formatCurrency(r.credit) : ""}</TableCell>}
                      {vis.has("closing") && (
                        <TableCell className={`text-right font-medium ${r.closing < 0 ? "text-red-600" : ""}`}>
                          {formatCurrency(Math.abs(r.closing))} {r.closing >= 0 ? "Dr" : "Cr"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
              }
              {rows.length > 0 && (
                <TableRow className="font-bold bg-muted/30">
                  <TableCell colSpan={visibleColumns.filter(c => !["debit","credit","closing","openingBalance"].includes(c.key)).length}>Total</TableCell>
                  {vis.has("openingBalance") && <TableCell />}
                  {vis.has("debit") && <TableCell className="text-right">{formatCurrency((data as any)?.totalDebit)}</TableCell>}
                  {vis.has("credit") && <TableCell className="text-right">{formatCurrency((data as any)?.totalCredit)}</TableCell>}
                  {vis.has("closing") && <TableCell />}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
