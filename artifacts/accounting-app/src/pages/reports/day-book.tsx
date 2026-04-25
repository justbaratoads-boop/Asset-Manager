import { useState } from "react";
import { useGetDayBook } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, today } from "@/lib/format";

export default function DayBook() {
  const [date, setDate] = useState(today());
  const { data, isLoading } = useGetDayBook({ date });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Day Book</h1>
        <div className="flex items-center gap-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Receipts</p><p className="text-xl font-bold text-green-600">{formatCurrency((data as any)?.totalCr)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Payments</p><p className="text-xl font-bold text-red-600">{formatCurrency((data as any)?.totalDr)}</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Ref#</TableHead><TableHead>Party</TableHead><TableHead className="text-right">Dr</TableHead><TableHead className="text-right">Cr</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !(data as any)?.entries?.length ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No entries for {date}</TableCell></TableRow>
                  : (data as any).entries.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{e.type}</TableCell>
                      <TableCell className="font-mono text-xs">{e.number}</TableCell>
                      <TableCell className="text-sm">{e.party || "-"}</TableCell>
                      <TableCell className="text-right">{e.dr > 0 ? formatCurrency(e.dr) : ""}</TableCell>
                      <TableCell className="text-right">{e.cr > 0 ? formatCurrency(e.cr) : ""}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
