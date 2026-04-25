import { useRoute, Link } from "wouter";
import { useGetPartyLedger, useGetParty } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export default function PartyLedger() {
  const [, params] = useRoute("/accounts/parties/:id");
  const id = Number(params?.id);
  const { data: party } = useGetParty(id, { query: { enabled: !!id } });
  const { data: ledger, isLoading } = useGetPartyLedger(id, undefined, { query: { enabled: !!id } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/accounts/parties"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
          <div>
            <h1 className="text-xl font-bold">{(party as any)?.name || "Party Ledger"}</h1>
            <p className="text-sm text-muted-foreground capitalize">{(party as any)?.type} · {(party as any)?.city}</p>
          </div>
        </div>
        {ledger && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Closing Balance</p>
            <p className={`text-xl font-bold ${(ledger as any).closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(Math.abs((ledger as any).closingBalance))} {(ledger as any).closingBalance >= 0 ? "Dr" : "Cr"}
            </p>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : !(ledger as any)?.transactions?.length ? (
            <p className="text-center text-muted-foreground py-8">No transactions found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ref</TableHead>
                  <TableHead className="text-right">Dr</TableHead>
                  <TableHead className="text-right">Cr</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ledger as any).transactions.map((t: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell className="font-mono text-xs">{t.ref}</TableCell>
                    <TableCell className="text-right">{t.dr > 0 ? formatCurrency(t.dr) : ""}</TableCell>
                    <TableCell className="text-right">{t.cr > 0 ? formatCurrency(t.cr) : ""}</TableCell>
                    <TableCell className={`text-right font-medium ${t.balance >= 0 ? "" : "text-red-600"}`}>
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
  );
}
