import { useState } from "react";
import { useGetAllTransactions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { ReportActions } from "@/components/report-actions";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useReportSort } from "@/hooks/use-report-sort";
import { useFY } from "@/lib/financial-year";
import { TransactionDetailSheet, TransactionTarget } from "@/components/transaction-detail-sheet";

const TYPE_COLORS: Record<string, string> = {
  "Sale Invoice": "bg-green-100 text-green-700",
  "Purchase Invoice": "bg-blue-100 text-blue-700",
  "Payment": "bg-red-100 text-red-700",
  "Receipt": "bg-emerald-100 text-emerald-700",
  "Journal": "bg-purple-100 text-purple-700",
  "Order": "bg-amber-100 text-amber-700",
  "Credit Note": "bg-orange-100 text-orange-700",
  "Debit Note": "bg-pink-100 text-pink-700",
};

const ALL_COLUMNS = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Type", key: "type" },
  { header: "Reference#", key: "number" },
  { header: "Party / Narration", key: "party" },
  { header: "Amount", key: "amount", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Debit", key: "debit", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
  { header: "Credit", key: "credit", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
];

const ALL_TYPES = ["Sale Invoice", "Purchase Invoice", "Payment", "Receipt", "Journal", "Order", "Credit Note", "Debit Note"];

export default function AllTransactions() {
  const { globalFrom: from, globalTo: to } = useFY();
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedTx, setSelectedTx] = useState<TransactionTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useGetAllTransactions({ from: from || undefined, to: to || undefined });
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("all-transactions", ALL_COLUMNS);
  const { sortedData, sortKey, sortDir, setSortKey, setSortDir, toggleSort } = useReportSort(transactions, "date", "desc");
  const vis = visibleKeys;

  let transactions: any[] = (data as any)?.transactions || [];
  if (typeFilter !== "all") transactions = transactions.filter((t: any) => t.type === typeFilter);

  const totalDebit = transactions.reduce((s: number, t: any) => s + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((s: number, t: any) => s + (t.credit || 0), 0);

  const handleRowClick = (t: any) => {
    if (t.id) {
      setSelectedTx({ type: t.type, id: t.id, number: t.number });
      setSheetOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">All Transactions</h1>
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
            filename={`all-transactions-${from}-${to}`}
            title="All Transactions"
            shareSummary={`Total Debit: ${formatCurrency(totalDebit)}, Total Credit: ${formatCurrency(totalCredit)}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label>Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ALL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-xl font-bold">{transactions.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Debit</p><p className="text-xl font-bold">{formatCurrency(totalDebit)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Credit</p><p className="text-xl font-bold">{formatCurrency(totalCredit)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {vis.has("date") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("date")}>Date {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("type") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("type")}>Type {sortKey === "type" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("number") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("number")}>Reference# {sortKey === "number" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("party") && <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("party")}>Party / Narration {sortKey === "party" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("amount") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>Amount {sortKey === "amount" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("debit") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("debit")}>Debit {sortKey === "debit" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                {vis.has("credit") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("credit")}>Credit {sortKey === "credit" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                : !sortedData.length
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">No transactions for selected period</TableCell></TableRow>
                  : transactions.map((t: any, i: number) => (
                      <TableRow
                        key={i}
                        className={t.id ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                        onClick={() => handleRowClick(t)}
                      >
                        {vis.has("date") && <TableCell className="text-sm">{formatDate(t.date)}</TableCell>}
                        {vis.has("type") && <TableCell><Badge variant="outline" className={`text-xs ${TYPE_COLORS[t.type] || ""}`}>{t.type}</Badge></TableCell>}
                        {vis.has("number") && <TableCell className="font-mono text-xs text-primary">{t.number}</TableCell>}
                        {vis.has("party") && <TableCell className="max-w-xs truncate text-sm">{t.party || "-"}</TableCell>}
                        {vis.has("amount") && <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>}
                        {vis.has("debit") && <TableCell className="text-right">{t.debit > 0 ? formatCurrency(t.debit) : ""}</TableCell>}
                        {vis.has("credit") && <TableCell className="text-right">{t.credit > 0 ? formatCurrency(t.credit) : ""}</TableCell>}
                      </TableRow>
                    ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Side Slider View for clicked Transaction */}
      <TransactionDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        transaction={selectedTx}
      />
    </div>
  );
}
