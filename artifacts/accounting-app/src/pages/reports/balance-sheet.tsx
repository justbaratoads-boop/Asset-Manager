import { useGetBalanceSheet } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Printer } from "lucide-react";

const GROUP_LABELS: Record<string, string> = {
  assets: "Fixed & Current Assets",
  "Sundry Debtors": "Sundry Debtors",
  "Bank Accounts": "Bank Accounts",
};

export default function BalanceSheet() {
  const { data, isLoading } = useGetBalanceSheet({});
  const d = data as any;

  // Group asset items by their group field for display
  const groupedAssets = (() => {
    const items: any[] = d?.assets?.items ?? [];
    const groups: Record<string, any[]> = {};
    for (const item of items) {
      const g = item.group ?? "assets";
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  })();

  const balances = (() => {
    if (!d) return null;
    const totalAssets = d.assets?.total ?? 0;
    const totalLC = d.totalLiabilitiesAndCapital ?? 0;
    const diff = Math.abs(totalAssets - totalLC);
    return { totalAssets, totalLC, balanced: diff < 0.01 };
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Balance Sheet</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden">
          <Printer className="h-3.5 w-3.5" />Print PDF
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}

      {!isLoading && d && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ASSETS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-blue-700">Assets</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {Object.entries(groupedAssets).map(([group, items]) => (
                      <>
                        <TableRow key={`hdr-${group}`} className="bg-muted/20">
                          <TableCell colSpan={2} className="py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {GROUP_LABELS[group] ?? group}
                          </TableCell>
                        </TableRow>
                        {(items as any[]).map((a: any, i: number) => (
                          <TableRow key={`${group}-${i}`}>
                            <TableCell className="pl-6">{a.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Math.abs(a.amount))}{a.amount < 0 ? " (Cr)" : ""}</TableCell>
                          </TableRow>
                        ))}
                      </>
                    ))}
                    <TableRow className="border-t-2 font-bold bg-blue-50 dark:bg-blue-950/20">
                      <TableCell>Total Assets</TableCell>
                      <TableCell className="text-right text-blue-700">{formatCurrency(d.assets?.total ?? 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* LIABILITIES & CAPITAL */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-700">Liabilities & Capital</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {/* Liabilities */}
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={2} className="py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Liabilities</TableCell>
                    </TableRow>
                    {(d.liabilities?.items ?? []).map((l: any, i: number) => (
                      <TableRow key={`lib-${i}`}>
                        <TableCell className="pl-6">{l.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Math.abs(l.amount))}{l.amount < 0 ? " (Dr)" : ""}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t">
                      <TableCell>Total Liabilities</TableCell>
                      <TableCell className="text-right">{formatCurrency(d.liabilities?.total ?? 0)}</TableCell>
                    </TableRow>

                    {/* Capital */}
                    <TableRow className="bg-muted/20">
                      <TableCell colSpan={2} className="py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Capital</TableCell>
                    </TableRow>
                    {(d.capital?.items ?? []).map((c: any, i: number) => (
                      <TableRow key={`cap-${i}`}>
                        <TableCell className="pl-6">{c.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Math.abs(c.amount))}{c.amount < 0 ? " (Dr)" : ""}</TableCell>
                      </TableRow>
                    ))}

                    {/* Net Profit / Loss */}
                    <TableRow>
                      <TableCell className="pl-6">
                        {(d.netProfit ?? 0) >= 0 ? "Net Profit (current year)" : "Net Loss (current year)"}
                      </TableCell>
                      <TableCell className={`text-right ${(d.netProfit ?? 0) < 0 ? "text-red-600" : "text-green-600"}`}>
                        {(d.netProfit ?? 0) < 0
                          ? `(${formatCurrency(Math.abs(d.netProfit))})`
                          : formatCurrency(d.netProfit)}
                      </TableCell>
                    </TableRow>

                    <TableRow className="font-semibold border-t">
                      <TableCell>Total Capital</TableCell>
                      <TableCell className="text-right">{formatCurrency((d.capital?.total ?? 0) + (d.netProfit ?? 0))}</TableCell>
                    </TableRow>

                    {/* Grand Total */}
                    <TableRow className="border-t-2 font-bold bg-red-50 dark:bg-red-950/20">
                      <TableCell>Total Liabilities & Capital</TableCell>
                      <TableCell className="text-right text-red-700">{formatCurrency(d.totalLiabilitiesAndCapital ?? 0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Balance check indicator */}
          {balances && (
            <div className="flex justify-end">
              <Badge variant={balances.balanced ? "default" : "destructive"} className="text-xs">
                {balances.balanced
                  ? "✓ Balance sheet is balanced"
                  : `⚠ Difference: ${formatCurrency(Math.abs(balances.totalAssets - balances.totalLC))}`}
              </Badge>
            </div>
          )}
        </>
      )}
    </div>
  );
}
