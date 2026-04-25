import { useGetBalanceSheet } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

export default function BalanceSheet() {
  const { data, isLoading } = useGetBalanceSheet();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Balance Sheet</h1>
      {isLoading ? <p className="text-muted-foreground">Loading...</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base text-blue-700">Assets</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {(data as any)?.assets?.items?.map((a: any, i: number) => <TableRow key={i}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatCurrency(a.amount)}</TableCell></TableRow>)}
                  <TableRow className="border-t font-bold"><TableCell>Total Assets</TableCell><TableCell className="text-right text-blue-600">{formatCurrency((data as any)?.assets?.total)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base text-red-700">Liabilities & Capital</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {(data as any)?.liabilities?.items?.map((l: any, i: number) => <TableRow key={i}><TableCell>{l.name}</TableCell><TableCell className="text-right">{formatCurrency(l.amount)}</TableCell></TableRow>)}
                  <TableRow className="font-semibold border-t"><TableCell>Total Liabilities</TableCell><TableCell className="text-right">{formatCurrency((data as any)?.liabilities?.total)}</TableCell></TableRow>
                  {(data as any)?.capital?.items?.map((c: any, i: number) => <TableRow key={`c${i}`}><TableCell>{c.name}</TableCell><TableCell className="text-right">{formatCurrency(c.amount)}</TableCell></TableRow>)}
                  <TableRow className="font-bold border-t"><TableCell>Total Capital</TableCell><TableCell className="text-right text-purple-600">{formatCurrency((data as any)?.capital?.total)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
