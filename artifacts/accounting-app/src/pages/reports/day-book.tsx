import { useState } from "react";
import { useGetDayBook } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, today, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useLocation } from "wouter";

const ALL_COLUMNS = [
  { header: "Type", key: "type" },
  { header: "Ref#", key: "number" },
  { header: "Party / Narration", key: "party" },
  { header: "Debit", key: "dr", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
  { header: "Credit", key: "cr", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
];

function navPath(type: string, id: number): string | null {
  switch (type) {
    case "Sale Invoice": return `/sales/invoices/${id}`;
    case "Purchase Invoice": return `/purchase/invoices/${id}/edit`;
    case "Payment": return `/accounts/payments/${id}/edit`;
    case "Receipt": return `/accounts/receipts/${id}/edit`;
    case "Credit Note": return `/accounts/credit-notes/${id}`;
    case "Debit Note": return `/accounts/debit-notes/${id}`;
    default: return null;
  }
}

export default function DayBook() {
  const [date, setDate] = useState(today());
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetDayBook({ date });
  const entries: any[] = (data as any)?.entries || [];
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("day-book", ALL_COLUMNS);
  const vis = visibleKeys;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Day Book</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" /></div>
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          <ExportButtons data={entries} columns={visibleColumns} filename={`day-book-${date}`} title={`Day Book — ${formatDate(date)}`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Receipts / Income</p><p className="text-xl font-bold text-green-600">{formatCurrency((data as any)?.totalCr)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Payments / Expense</p><p className="text-xl font-bold text-red-600">{formatCurrency((data as any)?.totalDr)}</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                {vis.has("type") && <TableHead>Type</TableHead>}
                {vis.has("number") && <TableHead>Ref#</TableHead>}
                {vis.has("party") && <TableHead>Party / Narration</TableHead>}
                {vis.has("dr") && <TableHead className="text-right">Debit</TableHead>}
                {vis.has("cr") && <TableHead className="text-right">Credit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !entries.length
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">No entries for {formatDate(date)}</TableCell></TableRow>
                  : entries.map((e: any, i: number) => {
                    const path = e.id ? navPath(e.type, e.id) : null;
                    return (
                      <TableRow
                        key={i}
                        className={path ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => { if (path) setLocation(path); }}
                      >
                        {vis.has("type") && <TableCell className="text-sm">{e.type}</TableCell>}
                        {vis.has("number") && <TableCell className="font-mono text-xs">{e.number}</TableCell>}
                        {vis.has("party") && <TableCell className="text-sm">{e.party || "-"}</TableCell>}
                        {vis.has("dr") && <TableCell className="text-right">{e.dr > 0 ? formatCurrency(e.dr) : ""}</TableCell>}
                        {vis.has("cr") && <TableCell className="text-right">{e.cr > 0 ? formatCurrency(e.cr) : ""}</TableCell>}
                      </TableRow>
                    );
                  })
              }
              {entries.length > 0 && (
                <TableRow className="font-bold bg-muted/30">
                  <TableCell colSpan={visibleColumns.filter(c => c.key !== "dr" && c.key !== "cr").length}>Total</TableCell>
                  {vis.has("dr") && <TableCell className="text-right">{formatCurrency((data as any)?.totalDr)}</TableCell>}
                  {vis.has("cr") && <TableCell className="text-right">{formatCurrency((data as any)?.totalCr)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
