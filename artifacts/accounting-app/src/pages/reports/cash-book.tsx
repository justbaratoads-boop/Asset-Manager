import { useState } from "react";
import { useGetCashBook } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";

export default function CashBook() {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const { data, isLoading } = useGetCashBook({ from: from || undefined, to: to || undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cash Book</h1>
        <div className="flex gap-3">
          <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
          <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Cash In</p><p className="text-xl font-bold text-green-600">{formatCurrency((data as any)?.totalIn)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Cash Out</p><p className="text-xl font-bold text-red-600">{formatCurrency((data as any)?.totalOut)}</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Ref</TableHead><TableHead className="text-right">Cash In</TableHead><TableHead className="text-right">Cash Out</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !(data as any)?.entries?.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No cash entries for selected period</TableCell></TableRow>
                  : (data as any).entries.map((e: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{formatDate(e.date)}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className="font-mono text-xs">{e.ref}</TableCell>
                      <TableCell className="text-right text-green-600">{e.cashIn > 0 ? formatCurrency(e.cashIn) : ""}</TableCell>
                      <TableCell className="text-right text-red-600">{e.cashOut > 0 ? formatCurrency(e.cashOut) : ""}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(e.balance)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
