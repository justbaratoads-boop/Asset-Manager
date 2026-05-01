import { useGetBalanceSheet } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Printer } from "lucide-react";

export default function BalanceSheet() {
  const { data, isLoading } = useGetBalanceSheet();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Balance Sheet</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden">
          <Printer className="h-3.5 w-3.5" />Print PDF
        </Button>
      </div>
      {isLoading
        ? <p className="text-muted-foreground">Loading...</p>
        : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base text-blue-700">Assets</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(data as any)?.assets?.items?.map((a: any, i: number) => (
                      <TableRow key={i}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.amount)}</TableCell></TableRow>
                    ))}
                    <TableRow className="border-t font-bold bg-muted/30">
                      <TableCell>Total Assets</TableCell>
                      <TableCell className="text-right text-blue-600">{formatCurrency((data as any)?.assets?.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base text-red-700">Liabilities & Capital</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    {(data as any)?.liabilities?.items?.length > 0 && (
                      <TableRow className="bg-muted/10"><TableCell className="font-semibold text-xs text-muted-foreground uppercase" colSpan={2}>Liabilities</TableCell></TableRow>
                    )}
                    {(data as any)?.liabilities?.items?.map((l: any, i: number) => (
                      <TableRow key={i}><TableCell>{l.name}</TableCell><TableCell className="text-right">{formatCurrency(l.amount)}</TableCell></TableRow>
                    ))}
                    <TableRow className="font-semibold border-t">
                      <TableCell>Total Liabilities</TableCell>
                      <TableCell className="text-right">{formatCurrency((data as any)?.liabilities?.total)}</TableCell>
                    </TableRow>
                    {(data as any)?.capital?.items?.length > 0 && (
                      <TableRow className="bg-muted/10"><TableCell className="font-semibold text-xs text-muted-foreground uppercase" colSpan={2}>Capital</TableCell></TableRow>
                    )}
                    {(data as any)?.capital?.items?.map((c: any, i: number) => (
                      <TableRow key={`c${i}`}><TableCell>{c.name}</TableCell><TableCell className="text-right">{formatCurrency(c.amount)}</TableCell></TableRow>
                    ))}
                    <TableRow className="font-bold border-t bg-muted/30">
                      <TableCell>Total Capital</TableCell>
                      <TableCell className="text-right text-purple-600">{formatCurrency((data as any)?.capital?.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )
      }
    </div>
  );
}
