import { useState } from "react";
import { useGetAllTransactions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { useFY } from "@/lib/financial-year";

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

const columns = [
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
  const { fy } = useFY();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const [typeFilter, setTypeFilter] = useState("all");
  const { data, isLoading } = useGetAllTransactions({ from: from || undefined, to: to || undefined });

  let transactions: any[] = (data as any)?.transactions || [];
  if (typeFilter !== "all") {
    transactions = transactions.filter((t: any) => t.type === typeFilter);
  }

  const totalDebit = transactions.reduce((s: number, t: any) => s + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((s: number, t: any) => s + (t.credit || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">All Transactions</h1>
        <ExportButtons data={transactions} columns={columns} filename={`all-transactions-${from}-${to}`} title="All Transactions" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
        <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
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

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Transactions</p><p className="text-xl font-bold">{transactions.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Debit</p><p className="text-xl font-bold">{formatCurrency(totalDebit)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Credit</p><p className="text-xl font-bold">{formatCurrency(totalCredit)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference#</TableHead>
                <TableHead>Party / Narration</TableHead><TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                : !transactions.length
                  ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transactions for selected period</TableCell></TableRow>
                  : transactions.map((t: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${TYPE_COLORS[t.type] || ""}`}>{t.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.number}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{t.party || "-"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(t.amount)}</TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
