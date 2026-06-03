// @ts-nocheck
import { useGetTrialBalance } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

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
  const vis = visibleKeys;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Trial Balance</h1>
        <div className="flex items-center gap-2">
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          <ExportButtons data={rows} columns={visibleColumns} filename="trial-balance" title="Trial Balance" />
        </div>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                {vis.has("name") && <TableHead>Ledger</TableHead>}
                {vis.has("group") && <TableHead>Group</TableHead>}
                {vis.has("nature") && <TableHead>Nature</TableHead>}
                {vis.has("openingBalance") && <TableHead className="text-right">Opening</TableHead>}
                {vis.has("debit") && <TableHead className="text-right">Debit</TableHead>}
                {vis.has("credit") && <TableHead className="text-right">Credit</TableHead>}
                {vis.has("closing") && <TableHead className="text-right">Balance</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !rows.length
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">No ledger data</TableCell></TableRow>
                  : rows.map((r: any) => (
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
