import { useState } from "react";
import { useGetCashBook } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useFY } from "@/lib/financial-year";
import { useLocation } from "wouter";

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
  const { fy, globalFrom, globalTo } = useFY();
  const [from, setFrom] = useState(globalFrom);
  const [to, setTo] = useState(globalTo);
  const [ledgerId, setLedgerId] = useState<string>("all");
  
  
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetCashBook({ from, to });
  const entries: any[] = (data as any)?.entries || [];
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("cash-book", ALL_COLUMNS);
  const vis = visibleKeys;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Cash Book</h1>
        <div className="flex flex-wrap items-center gap-2">
          
          
          <div className="flex items-center gap-2">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from || ""} onChange={e => setFrom(e.target.value)} className="h-8 w-36 text-xs" />
            <Label className="text-xs">To</Label>
            <Input type="date" value={to || ""} onChange={e => setTo(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          <ExportButtons data={entries} columns={visibleColumns} filename={`cash-book-${from}-${to}`} title="Cash Book" />
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
                {vis.has("balance") && <TableHead className="text-right">Balance</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !entries.length
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">No cash entries for selected period</TableCell></TableRow>
                  : entries.map((e: any, i: number) => {
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
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


