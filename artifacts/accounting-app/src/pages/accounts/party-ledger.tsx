// @ts-nocheck
import { useRoute, useSearch, Link } from "wouter";
import { useGetPartyLedger, useGetParty } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Building2, ShieldCheck, ShieldOff, Info } from "lucide-react";
import { ReportActions } from "@/components/report-actions";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useReportSort } from "@/hooks/use-report-sort";
import { TransactionDetailSheet, TransactionTarget } from "@/components/transaction-detail-sheet";
import { useState } from "react";

const gstBadge: Record<string, { label: string; cls: string }> = {
  registered:   { label: "Registered",   cls: "bg-green-100 text-green-800 border-green-300" },
  unregistered: { label: "Unregistered", cls: "bg-gray-100 text-gray-700 border-gray-300" },
  composition:  { label: "Composition",  cls: "bg-blue-100 text-blue-800 border-blue-300" },
};

const txTypeLabel: Record<string, string> = {
  sale_invoice: "Sale Invoice",
  purchase_invoice: "Purchase Invoice",
  receipt: "Receipt",
  payment: "Payment",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
  journal: "Journal",
};

export default function PartyView() {
  const [, params] = useRoute("/accounts/parties/:id");
  const id = Number(params?.id);
  const search = useSearch();
  const backHref = new URLSearchParams(search).get("from") === "ledgers"
    ? "/accounts/ledgers"
    : "/accounts/parties";

  const { data: party } = useGetParty(id, { query: { enabled: !!id } });
  const { data: ledger, isLoading } = useGetPartyLedger(id, undefined, { query: { enabled: !!id } });

  const p = party as any;
  const l = ledger as any;
  const gst = gstBadge[p?.gstType] ?? gstBadge.unregistered;

  const ALL_COLUMNS = [
    { header: "Date", key: "date", format: formatDate },
    { header: "Type", key: "type" },
    { header: "Description", key: "description" },
    { header: "Ref #", key: "ref" },
    { header: "Debit", key: "dr", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
    { header: "Credit", key: "cr", format: (v: any) => v > 0 ? String(Number(v).toFixed(2)) : "" },
    { header: "Balance", key: "balance", format: (v: any) => String(Number(v).toFixed(2)) },
  ];
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("party-ledger", ALL_COLUMNS);
  const rawTxs = l?.transactions || [];
  const { sortedData, sortKey, sortDir, setSortKey, setSortDir, toggleSort } = useReportSort(rawTxs, "date", "desc");
  const vis = visibleKeys;
  const [selectedTx, setSelectedTx] = useState<TransactionTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleRowClick = (t: any) => {
    if (t.id) {
      setSelectedTx({ type: t.type, id: t.id, number: t.ref });
      setSheetOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href={backHref}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{p?.name || "Party"}</h1>
            <p className="text-sm text-muted-foreground">{p?.accountGroup}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {l && (
            <div className="text-right mr-2">
              <p className="text-xs text-muted-foreground">Closing Balance</p>
              <p className={`text-lg font-bold ${l.closingBalance >= 0 ? "text-blue-700" : "text-red-600"}`}>
                {formatCurrency(Math.abs(l.closingBalance))} {l.closingBalance >= 0 ? "Dr" : "Cr"}
              </p>
            </div>
          )}
          <Link href={`/reports/interest-calculation?partyId=${id}`}>
            <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              Interest Calculation
            </Button>
          </Link>
          <Link href={`/accounts/parties/${id}/edit`}>
            <Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit</Button>
          </Link>
        </div>
      </div>

      {/* Party Details */}
      {p && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact & Address */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact & Address</p>
              {p.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{p.phone}</span>
                </div>
              )}
              {p.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{p.email}</span>
                </div>
              )}
              {(p.address || p.city || p.state) && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>
                    {[p.address, p.city, p.state, p.pincode].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
              {p.isOutOfState === "true" && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Out of State — IGST applies
                </div>
              )}
            </CardContent>
          </Card>

          {/* GST & PAN */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">GST & Tax Info</p>
              <div className="flex items-center gap-2">
                {p.gstType === "unregistered"
                  ? <ShieldOff className="h-4 w-4 text-gray-400" />
                  : <ShieldCheck className="h-4 w-4 text-green-600" />}
                <Badge variant="outline" className={gst.cls}>{gst.label}</Badge>
              </div>
              {p.gstin && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-mono">{p.gstin}</span>
                </div>
              )}
              {p.pan && (
                <div className="text-sm">
                  <span className="text-muted-foreground">PAN: </span>
                  <span className="font-mono">{p.pan}</span>
                </div>
              )}
              {Array.isArray(p.gstHistory) && p.gstHistory.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  GST History: {p.gstHistory.length} {p.gstHistory.length === 1 ? "entry" : "entries"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial */}
          <Card className="md:col-span-2">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financial</p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Opening Balance</p>
                  <p className="text-base font-semibold">
                    {formatCurrency(Number(p.openingBalance))}
                    <span className="text-xs text-muted-foreground uppercase ml-1">{p.balanceType}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Credit Limit</p>
                  <p className="text-base font-semibold">
                    {p.creditLimitEnabled === "true"
                      ? p.creditLimit ? formatCurrency(Number(p.creditLimit)) : "Allowed (unlimited)"
                      : <span className="text-muted-foreground text-sm">Not set</span>
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h2 className="text-base font-semibold">All Transactions</h2>
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
            filename={`party-ledger-${p?.name || "party"}`}
            title={`${p?.name || "Party"} Statement`}
            shareSummary={l ? `Party: ${p?.name}, Closing Balance: ${formatCurrency(Math.abs(l.closingBalance))} ${l.closingBalance >= 0 ? "Dr" : "Cr"}` : undefined}
          />
        </div>
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : !l?.transactions?.length ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead className="text-right">Dr</TableHead>
                    <TableHead className="text-right">Cr</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((t: any, i: number) => (
                    <TableRow key={i} className={t.id ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""} onClick={() => handleRowClick(t)}>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(t.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {txTypeLabel[t.type] || t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{t.description}</TableCell>
                      <TableCell className="font-mono text-xs">{t.ref}</TableCell>
                      <TableCell className="text-right text-sm">{t.dr > 0 ? formatCurrency(t.dr) : ""}</TableCell>
                      <TableCell className="text-right text-sm">{t.cr > 0 ? formatCurrency(t.cr) : ""}</TableCell>
                      <TableCell className={`text-right font-medium text-sm ${t.balance >= 0 ? "" : "text-red-600"}`}>
                        {formatCurrency(Math.abs(t.balance))} {t.balance >= 0 ? "Dr" : "Cr"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Side Tray View for clicked Transaction */}
      <TransactionDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        transaction={selectedTx}
      />
    </div>
  );
}
