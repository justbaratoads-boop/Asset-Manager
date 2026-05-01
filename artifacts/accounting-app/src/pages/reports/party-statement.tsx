import { useState } from "react";
import { useListParties, useGetPartyStatement } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { useFY } from "@/lib/financial-year";

const columns = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Type", key: "type" },
  { header: "Reference#", key: "number" },
  { header: "Debit", key: "debit", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
  { header: "Credit", key: "credit", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
  { header: "Balance", key: "balance", format: (v: any) => String(Number(v).toFixed(2)) },
];

const TYPE_COLORS: Record<string, string> = {
  "Sale Invoice": "bg-green-100 text-green-700",
  "Purchase Invoice": "bg-blue-100 text-blue-700",
  "Payment": "bg-red-100 text-red-700",
  "Receipt": "bg-emerald-100 text-emerald-700",
};

export default function PartyStatement() {
  const { fy } = useFY();
  const [partyId, setPartyId] = useState<string>("");
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const { data: parties = [] } = useListParties();
  const { data, isLoading } = useGetPartyStatement({ partyId: partyId || undefined, from: from || undefined, to: to || undefined });

  const transactions: any[] = (data as any)?.transactions || [];
  const closingBalance = (data as any)?.closingBalance || 0;
  const selectedParty = (parties as any[]).find((p: any) => p.id === Number(partyId));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Party Statement</h1>
        {transactions.length > 0 && (
          <ExportButtons data={transactions} columns={columns} filename={`party-statement-${selectedParty?.name || ""}`} title={`Party Statement — ${selectedParty?.name || ""}`} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Label>Party</Label>
          <Select value={partyId} onValueChange={setPartyId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Select party" /></SelectTrigger>
            <SelectContent>
              {(parties as any[]).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
        <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
      </div>

      {selectedParty && (
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
          <div><span className="text-muted-foreground">Party: </span><span className="font-semibold">{selectedParty.name}</span></div>
          {selectedParty.gstin && <div><span className="text-muted-foreground">GSTIN: </span><span>{selectedParty.gstin}</span></div>}
          {selectedParty.phone && <div><span className="text-muted-foreground">Ph: </span><span>{selectedParty.phone}</span></div>}
          <div className="ml-auto">
            <span className="text-muted-foreground mr-2">Closing Balance:</span>
            <span className={`font-bold text-base ${closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}
            </span>
          </div>
        </div>
      )}

      {!partyId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a party to view their statement</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference#</TableHead>
                  <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  : !transactions.length
                    ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions for this party in selected period</TableCell></TableRow>
                    : transactions.map((t: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-xs ${TYPE_COLORS[t.type] || ""}`}>{t.type}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{t.number}</TableCell>
                        <TableCell className="text-right text-red-600">{t.debit > 0 ? formatCurrency(t.debit) : ""}</TableCell>
                        <TableCell className="text-right text-green-600">{t.credit > 0 ? formatCurrency(t.credit) : ""}</TableCell>
                        <TableCell className={`text-right font-medium ${t.balance < 0 ? "text-red-600" : ""}`}>{formatCurrency(Math.abs(t.balance))} {t.balance >= 0 ? "Dr" : "Cr"}</TableCell>
                      </TableRow>
                    ))
                }
                {transactions.length > 0 && (
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={5}>Closing Balance</TableCell>
                    <TableCell className={`text-right ${closingBalance < 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatCurrency(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
