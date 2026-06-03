// @ts-nocheck
import { useRoute, useSearch, Link } from "wouter";
import { useGetPartyLedger, useGetParty } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Pencil, Phone, Mail, MapPin, Building2, ShieldCheck, ShieldOff, Info } from "lucide-react";

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
        <h2 className="text-base font-semibold mb-2">All Transactions</h2>
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
                  {l.transactions.map((t: any, i: number) => (
                    <TableRow key={i}>
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
    </div>
  );
}
