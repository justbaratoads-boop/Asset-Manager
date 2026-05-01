import { useState } from "react";
import { useGetDayBook } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, today, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";

const columns = [
  { header: "Type", key: "type" },
  { header: "Ref#", key: "number" },
  { header: "Party", key: "party" },
  { header: "Debit", key: "dr", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
  { header: "Credit", key: "cr", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
];

export default function DayBook() {
  const [date, setDate] = useState(today());
  const { data, isLoading } = useGetDayBook({ date });
  const entries: any[] = (data as any)?.entries || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Day Book</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" /></div>
          <ExportButtons data={entries} columns={columns} filename={`day-book-${date}`} title={`Day Book — ${formatDate(date)}`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Receipts / Income</p><p className="text-xl font-bold text-green-600">{formatCurrency((data as any)?.totalCr)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Payments / Expense</p><p className="text-xl font-bold text-red-600">{formatCurrency((data as any)?.totalDr)}</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Ref#</TableHead><TableHead>Party</TableHead><TableHead className="text-right">Dr</TableHead><TableHead className="text-right">Cr</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !entries.length
                  ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No entries for {formatDate(date)}</TableCell></TableRow>
                  : entries.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{e.type}</TableCell>
                      <TableCell className="font-mono text-xs">{e.number}</TableCell>
                      <TableCell className="text-sm">{e.party || "-"}</TableCell>
                      <TableCell className="text-right">{e.dr > 0 ? formatCurrency(e.dr) : ""}</TableCell>
                      <TableCell className="text-right">{e.cr > 0 ? formatCurrency(e.cr) : ""}</TableCell>
                    </TableRow>
                  ))
              }
              {entries.length > 0 && (
                <TableRow className="font-bold bg-muted/30">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency((data as any)?.totalDr)}</TableCell>
                  <TableCell className="text-right">{formatCurrency((data as any)?.totalCr)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
