import { useGetTrialBalance } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";

const groupColors: Record<string, string> = {
  assets: "bg-blue-100 text-blue-700",
  liabilities: "bg-red-100 text-red-700",
  income: "bg-green-100 text-green-700",
  expense: "bg-orange-100 text-orange-700",
  capital: "bg-purple-100 text-purple-700",
};

const columns = [
  { header: "Ledger", key: "name" },
  { header: "Group", key: "group" },
  { header: "Nature", key: "nature" },
  { header: "Opening Balance", key: "openingBalance", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Debit", key: "debit", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Credit", key: "credit", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Closing Balance", key: "closing", format: (v: any) => String(Number(v).toFixed(2)) },
];

export default function TrialBalance() {
  const { data, isLoading } = useGetTrialBalance();
  const rows: any[] = (data as any)?.rows || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Trial Balance</h1>
        <ExportButtons data={rows} columns={columns} filename="trial-balance" title="Trial Balance" />
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ledger</TableHead><TableHead>Group</TableHead>
                <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !rows.length
                  ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No ledger data</TableCell></TableRow>
                  : rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs capitalize ${groupColors[r.group] || ""}`}>{r.group}</Badge></TableCell>
                      <TableCell className="text-right">{r.debit > 0 ? formatCurrency(r.debit) : ""}</TableCell>
                      <TableCell className="text-right">{r.credit > 0 ? formatCurrency(r.credit) : ""}</TableCell>
                      <TableCell className={`text-right font-medium ${r.closing < 0 ? "text-red-600" : ""}`}>
                        {formatCurrency(Math.abs(r.closing))} {r.closing >= 0 ? "Dr" : "Cr"}
                      </TableCell>
                    </TableRow>
                  ))
              }
              {rows.length > 0 && (
                <TableRow className="font-bold bg-muted/30">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency((data as any)?.totalDebit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency((data as any)?.totalCredit)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
