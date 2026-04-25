import { useGetTrialBalance } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFoot, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";

const groupColors: Record<string, string> = { assets: "bg-blue-100 text-blue-700", liabilities: "bg-red-100 text-red-700", income: "bg-green-100 text-green-700", expense: "bg-orange-100 text-orange-700", capital: "bg-purple-100 text-purple-700" };

export default function TrialBalance() {
  const { data, isLoading } = useGetTrialBalance();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Trial Balance</h1>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Ledger</TableHead><TableHead>Group</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : !(data as any)?.rows?.length ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No data</TableCell></TableRow>
                  : (data as any).rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs capitalize ${groupColors[r.group] || ""}`}>{r.group}</Badge></TableCell>
                      <TableCell className="text-right">{r.debit > 0 ? formatCurrency(r.debit) : ""}</TableCell>
                      <TableCell className="text-right">{r.credit > 0 ? formatCurrency(r.credit) : ""}</TableCell>
                      <TableCell className={`text-right font-medium ${r.closing >= 0 ? "" : "text-red-600"}`}>{formatCurrency(Math.abs(r.closing))} {r.closing >= 0 ? "Dr" : "Cr"}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
            {(data as any)?.totalDebit && (
              <tfoot>
                <tr className="border-t font-bold">
                  <td className="p-2" colSpan={2}>Total</td>
                  <td className="p-2 text-right">{formatCurrency((data as any).totalDebit)}</td>
                  <td className="p-2 text-right">{formatCurrency((data as any).totalCredit)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
