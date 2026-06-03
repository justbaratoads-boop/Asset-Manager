// @ts-nocheck
import { useState } from "react";
import { useListParties, useGetPartyStatement, useListLedgers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useFY } from "@/lib/financial-year";
import { useLocation } from "wouter";

const ALL_COLUMNS = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Type", key: "type" },
  { header: "Reference#", key: "number" },
  { header: "Narration", key: "narration" },
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

function navPath(type: string, id: number): string | null {
  switch (type) {
    case "Sale Invoice": return `/sales/invoices/${id}`;
    case "Purchase Invoice": return `/purchase/invoices/${id}/edit`;
    case "Payment": return `/accounts/payments/${id}/edit`;
    case "Receipt": return `/accounts/receipts/${id}/edit`;
    default: return null;
  }
}

export default function PartyStatement() {
  const { fy, globalFrom: from, globalTo: to } = useFY();
  const [partyId, setPartyId] = useState<string>("");
  
  
  const [, setLocation] = useLocation();
  const { data: rawParties = [] } = useListParties();
  const { data: rawLedgers = [] } = useListLedgers({});
  const { data, isLoading } = useGetPartyStatement({ partyId: partyId ? Number(partyId) : undefined, from, to });
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("party-statement", ALL_COLUMNS);
  const vis = visibleKeys;

  const transactions: any[] = (data as any)?.transactions || [];
  const closingBalance = (data as any)?.closingBalance || 0;
  
  const allAccounts = [
    ...(rawLedgers as any[]).map(l => ({ id: `ledger_${l.id}`, name: l.name, group: l.group, kind: "Ledger", phone: null, gstin: null })),
    ...(rawParties as any[]).map(p => ({ id: `party_${p.id}`, name: p.name, group: "Parties", kind: "Party", phone: p.phone, gstin: p.gstin })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const selectedAccount = allAccounts.find(a => a.id === partyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Ledger Statement</h1>
        <div className="flex items-center gap-2">
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          {transactions.length > 0 && (
            <ExportButtons data={transactions} columns={visibleColumns} filename={`ledger-statement-${selectedAccount?.name || ""}`} title={`Ledger Statement — ${selectedAccount?.name || ""}`} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Label>Account</Label>
          <Select value={partyId} onValueChange={setPartyId}>
            <SelectTrigger className="w-[300px]"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent className="max-h-[400px]">
              {allAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} <span className="text-xs text-muted-foreground ml-2">({a.group})</span></SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        
      </div>

      {selectedAccount && (
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg text-sm">
          <div><span className="text-muted-foreground">Account: </span><span className="font-semibold">{selectedAccount.name}</span> <Badge variant="secondary" className="ml-2 text-[10px]">{selectedAccount.group}</Badge></div>
          {selectedAccount.gstin && <div><span className="text-muted-foreground ml-4">GSTIN: </span><span>{selectedAccount.gstin}</span></div>}
          {selectedAccount.phone && <div><span className="text-muted-foreground ml-4">Ph: </span><span>{selectedAccount.phone}</span></div>}
          <div className="ml-auto">
            <span className="text-muted-foreground mr-2">Closing Balance:</span>
            <span className={`font-bold text-base ${closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}
            </span>
          </div>
        </div>
      )}

      {!partyId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select an account to view its statement</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {vis.has("date") && <TableHead>Date</TableHead>}
                  {vis.has("type") && <TableHead>Type</TableHead>}
                  {vis.has("number") && <TableHead>Reference#</TableHead>}
                  {vis.has("narration") && <TableHead>Narration</TableHead>}
                  {vis.has("debit") && <TableHead className="text-right">Debit</TableHead>}
                  {vis.has("credit") && <TableHead className="text-right">Credit</TableHead>}
                  {vis.has("balance") && <TableHead className="text-right">Balance</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  : !transactions.length
                    ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">No transactions found in selected period</TableCell></TableRow>
                    : transactions.map((t: any, i: number) => {
                      const path = t.id ? navPath(t.type, t.id) : null;
                      return (
                        <TableRow
                          key={i}
                          className={path ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={() => { if (path) setLocation(path); }}
                        >
                          {vis.has("date") && <TableCell className="text-sm">{formatDate(t.date)}</TableCell>}
                          {vis.has("type") && <TableCell><Badge variant="outline" className={`text-xs ${TYPE_COLORS[t.type] || ""}`}>{t.type}</Badge></TableCell>}
                          {vis.has("number") && <TableCell className="font-mono text-xs">{t.number}</TableCell>}
                          {vis.has("narration") && <TableCell className="text-sm text-muted-foreground">{t.narration || "-"}</TableCell>}
                          {vis.has("debit") && <TableCell className="text-right text-red-600">{t.debit > 0 ? formatCurrency(t.debit) : ""}</TableCell>}
                          {vis.has("credit") && <TableCell className="text-right text-green-600">{t.credit > 0 ? formatCurrency(t.credit) : ""}</TableCell>}
                          {vis.has("balance") && <TableCell className={`text-right font-medium ${t.balance < 0 ? "text-red-600" : ""}`}>{formatCurrency(Math.abs(t.balance))} {t.balance >= 0 ? "Dr" : "Cr"}</TableCell>}
                        </TableRow>
                      );
                    })
                }
                {transactions.length > 0 && (
                  <TableRow className="font-bold bg-muted/30">
                    <TableCell colSpan={visibleColumns.filter(c => !["debit","credit","balance"].includes(c.key)).length}>Closing Balance</TableCell>
                    {vis.has("debit") && <TableCell />}
                    {vis.has("credit") && <TableCell />}
                    {vis.has("balance") && (
                      <TableCell className={`text-right ${closingBalance < 0 ? "text-red-600" : "text-green-600"}`}>
                        {formatCurrency(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}
                      </TableCell>
                    )}
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


