// @ts-nocheck
import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch, useGetLedger } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, today } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { useFY } from "@/lib/financial-year";

const txTypeLabel: Record<string, string> = {
  journal: "Journal",
  payment: "Payment",
  receipt: "Receipt",
  sale_invoice: "Sale Invoice",
  purchase_invoice: "Purchase Invoice",
};

const txTypeColors: Record<string, string> = {
  journal: "bg-purple-50 text-purple-700 border-purple-200",
  payment: "bg-red-50 text-red-700 border-red-200",
  receipt: "bg-green-50 text-green-700 border-green-200",
  sale_invoice: "bg-sky-50 text-sky-700 border-sky-200",
  purchase_invoice: "bg-orange-50 text-orange-700 border-orange-200",
};

function fyStart(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
}

export default function LedgerStatement() {
  const [, params] = useRoute("/accounts/ledgers/:id");
  const id = Number(params?.id);
  const { globalFrom: from, globalTo: to, setGlobalFrom: setFrom, setGlobalTo: setTo } = useFY();

  const { data: ledger } = useGetLedger(id, { query: { enabled: !!id } });

  const { data: statement, isLoading } = useQuery({
    queryKey: ["ledger-statement", id, from, to],
    queryFn: () => customFetch<any>(`/api/ledgers/${id}/statement?from=${from}&to=${to}`),
    enabled: !!id,
  });

  const s = statement as any;
  const l = ledger as any;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/accounts/ledgers">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{l?.name || "Ledger Statement"}</h1>
            <p className="text-sm text-muted-foreground">{l?.group}</p>
          </div>
        </div>
        {s && (
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Opening Balance</p>
              <p className="text-sm font-semibold">
                {formatCurrency(Math.abs(s.openingBalance))}
                <span className="text-xs text-muted-foreground ml-1">{s.nature === "dr" ? "Dr" : "Cr"}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Dr</p>
              <p className="text-sm font-semibold text-blue-700">{formatCurrency(s.totalDr)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total Cr</p>
              <p className="text-sm font-semibold text-rose-600">{formatCurrency(s.totalCr)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Closing Balance</p>
              <p className={`text-lg font-bold ${s.closingBalance >= 0 ? "text-blue-700" : "text-red-600"}`}>
                {formatCurrency(Math.abs(s.closingBalance))}
                <span className="text-sm ml-1">{s.closingBalance >= 0 ? "Dr" : "Cr"}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="h-8 w-36 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-10">Loading...</p>
          ) : !s?.transactions?.length ? (
            <p className="text-center text-muted-foreground py-10">No transactions in this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ref #</TableHead>
                  <TableHead className="text-right">Dr</TableHead>
                  <TableHead className="text-right">Cr</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.transactions.map((t: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(t.date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs whitespace-nowrap ${txTypeColors[t.type] ?? ""}`}
                      >
                        {txTypeLabel[t.type] ?? t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{t.description}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{t.ref}</TableCell>
                    <TableCell className="text-right text-sm">
                      {t.dr > 0 ? <span className="text-blue-700 font-medium">{formatCurrency(t.dr)}</span> : ""}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {t.cr > 0 ? <span className="text-rose-600 font-medium">{formatCurrency(t.cr)}</span> : ""}
                    </TableCell>
                    <TableCell className={`text-right font-semibold text-sm ${t.balance >= 0 ? "text-blue-700" : "text-red-600"}`}>
                      {formatCurrency(Math.abs(t.balance))} {t.balance >= 0 ? "Dr" : "Cr"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Footer totals */}
      {s?.transactions?.length > 0 && (
        <div className="flex justify-end">
          <div className="text-sm text-muted-foreground">
            {s.transactions.length} transaction{s.transactions.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

