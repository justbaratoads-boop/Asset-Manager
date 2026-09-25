// @ts-nocheck
import { useState } from "react";
import { useListParties, useGetPartyStatement, useListLedgers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ReportActions } from "@/components/report-actions";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useReportSort } from "@/hooks/use-report-sort";
import { TransactionDetailSheet, TransactionTarget } from "@/components/transaction-detail-sheet";
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
  "Opening Balance": "bg-amber-100 text-amber-800 font-semibold",
  opening_balance: "bg-amber-100 text-amber-800 font-semibold",
  "Credit Note": "bg-orange-100 text-orange-700",
  "Debit Note": "bg-pink-100 text-pink-700",
  "Journal": "bg-purple-100 text-purple-700",
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
  const [open, setOpen] = useState(false);
  
  
  const [, setLocation] = useLocation();
  const { data: rawParties = [] } = useListParties();
  const { data: rawLedgers = [] } = useListLedgers({});
  const { data, isLoading } = useGetPartyStatement({ partyId: partyId ? partyId as any : undefined, from, to });
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("party-statement", ALL_COLUMNS);
  const { sortedData, sortKey, sortDir, setSortKey, setSortDir, toggleSort } = useReportSort(transactions, "date", "desc");
  const vis = visibleKeys;

  const transactions: any[] = (data as any)?.transactions || [];
  const closingBalance = (data as any)?.closingBalance || 0;
  
  const allAccounts = [
    ...(rawLedgers as any[]).filter(l => l.id < 1000000).map(l => ({ id: `ledger_${l.id}`, name: l.name, group: l.group, kind: "Ledger", phone: null, gstin: null })),
    ...(rawParties as any[]).map(p => ({ id: `party_${p.id}`, name: p.name, group: "Parties", kind: "Party", phone: p.phone, gstin: p.gstin })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const selectedAccount = allAccounts.find(a => a.id === partyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Ledger Statement</h1>
        <div className="flex items-center gap-2">
          {partyId && partyId.startsWith("party_") && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/reports/interest-calculation?partyId=${partyId.split('_')[1]}`)}>
              Interest Calculation
            </Button>
          )}
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
            filename={`ledger-statement-${selectedAccount?.name || ""}`}
            title={`Ledger Statement — ${selectedAccount?.name || ""}`}
            shareSummary={selectedAccount ? `Account: ${selectedAccount.name}, Closing Balance: ${formatCurrency(Math.abs(closingBalance))} ${closingBalance >= 0 ? "Dr" : "Cr"}` : undefined}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Label>Account</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[300px] justify-between font-normal"
              >
                {selectedAccount ? selectedAccount.name : "Select account"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Search account..." />
                <CommandList>
                  <CommandEmpty>No account found.</CommandEmpty>
                  <CommandGroup>
                    {allAccounts.map((a) => (
                      <CommandItem
                        key={a.id}
                        value={`${a.name} ${a.group}`}
                        onSelect={() => {
                          setPartyId(a.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            partyId === a.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {a.name} <span className="text-xs text-muted-foreground ml-2">({a.group})</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
                  {vis.has("debit") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("debit")}>Debit {sortKey === "debit" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                  {vis.has("credit") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("credit")}>Credit {sortKey === "credit" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                  {vis.has("balance") && <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("balance")}>Balance {sortKey === "balance" ? (sortDir === "asc" ? "↑" : "↓") : ""}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  : !sortedData.length
                    ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">No transactions found in selected period</TableCell></TableRow>
                    : sortedData.map((t: any, i: number) => {
                      return (
                        <TableRow
                          key={i}
                          className={t.id ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                          onClick={() => handleRowClick(t)}
                        >
                          {vis.has("date") && <TableCell className="text-sm">{formatDate(t.date)}</TableCell>}
                          {vis.has("type") && <TableCell><Badge variant="outline" className={`text-xs ${TYPE_COLORS[t.type] || ""}`}>{t.type}</Badge></TableCell>}
                          {vis.has("number") && <TableCell className="font-mono text-xs">{t.number}</TableCell>}
                          {vis.has("narration") && <TableCell className="text-sm text-muted-foreground">{t.narration || ""}</TableCell>}
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
      {/* Side Tray View for clicked Transaction */}
      <TransactionDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        transaction={selectedTx}
      />
    </div>
  );
}


