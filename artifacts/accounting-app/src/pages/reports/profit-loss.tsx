import { useState } from "react";
import { useGetProfitLoss } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { Printer } from "lucide-react";
import { useFY } from "@/lib/financial-year";

export default function ProfitLoss() {
  const { fy, globalFrom: from, globalTo: to } = useFY();
  
  
  const { data, isLoading } = useGetProfitLoss({ from, to });

  const d = data as any;

  const Row = ({ label, value, sub, bold, negative }: { label: string; value: number; sub?: boolean; bold?: boolean; negative?: boolean }) => (
    <div className={`flex justify-between items-center py-1 ${sub ? "pl-4 text-muted-foreground" : ""} ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className={negative && value > 0 ? "text-red-600" : ""}>{negative && value > 0 ? `(${formatCurrency(value)})` : formatCurrency(value)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Profit & Loss Statement</h1>
        <div className="flex flex-wrap items-center gap-3">
          
          
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden">
            <Printer className="h-3.5 w-3.5" />Print PDF
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

      {!isLoading && d && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Income */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base text-green-700">Income</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-0.5">
              <Row label="Sales Revenue (excl. GST)" value={d.income?.sales ?? 0} />
              {(d.income?.salesReturns ?? 0) > 0 && (
                <Row label="Less: Sales Returns (Credit Notes)" value={d.income?.salesReturns ?? 0} sub negative />
              )}
              <Separator className="my-1.5" />
              <Row label="Net Sales" value={d.income?.netSales ?? 0} bold />

              {/* Other income from journal entries */}
              {Object.keys(d.income?.otherIncome ?? {}).length > 0 && (
                <>
                  <div className="pt-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Other Income</div>
                  {Object.entries(d.income.otherIncome as Record<string, number>).map(([name, val]) => (
                    <Row key={name} label={name} value={val} sub />
                  ))}
                </>
              )}

              <Separator className="my-1.5" />
              <Row label="Total Income" value={d.income?.total ?? 0} bold />
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base text-red-700">Expenses</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-0.5">
              <Row label="Purchases (excl. GST)" value={d.expenses?.purchases ?? 0} />
              {(d.expenses?.purchaseReturns ?? 0) > 0 && (
                <Row label="Less: Purchase Returns (Debit Notes)" value={d.expenses?.purchaseReturns ?? 0} sub negative />
              )}
              <Separator className="my-1.5" />
              <Row label="Net Purchases" value={d.expenses?.netPurchases ?? 0} bold />

              {/* Other expenses from journal entries */}
              {Object.keys(d.expenses?.otherExpenses ?? {}).length > 0 && (
                <>
                  <div className="pt-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Operating Expenses</div>
                  {Object.entries(d.expenses.otherExpenses as Record<string, number>).map(([name, val]) => (
                    <Row key={name} label={name} value={val} sub />
                  ))}
                </>
              )}

              <Separator className="my-1.5" />
              <Row label="Total Expenses" value={d.expenses?.total ?? 0} bold />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary */}
      {!isLoading && d && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Gross Profit</span>
                <span className={`text-lg font-bold ${(d.grossProfit ?? 0) >= 0 ? "text-blue-700" : "text-red-600"}`}>
                  {(d.grossProfit ?? 0) >= 0 ? formatCurrency(d.grossProfit) : `(${formatCurrency(Math.abs(d.grossProfit))})`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Net Sales minus Net Purchases</p>
            </CardContent>
          </Card>

          <Card className={(d.netProfit ?? 0) >= 0 ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}>
            <CardContent className="p-4 text-sm">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-lg">{(d.netProfit ?? 0) >= 0 ? "Net Profit" : "Net Loss"}</p>
                  <p className="text-xs text-muted-foreground">Period: {from} to {to}</p>
                </div>
                <p className={`text-3xl font-bold ${(d.netProfit ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(Math.abs(d.netProfit ?? 0))}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}


