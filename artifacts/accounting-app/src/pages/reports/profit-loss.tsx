import { useState } from "react";
import { useGetProfitLoss } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";

export default function ProfitLoss() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useGetProfitLoss({ from: from || undefined, to: to || undefined });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profit & Loss Statement</h1>
        <div className="flex gap-3">
          <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
          <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base text-green-700">Income</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLoading ? <p className="text-muted-foreground">Loading...</p> : <>
              <div className="flex justify-between"><span>Sales</span><span>{formatCurrency((data as any)?.income?.sales)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>Total Income</span><span className="text-green-600">{formatCurrency((data as any)?.income?.total)}</span></div>
            </>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-red-700">Expenses</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isLoading ? <p className="text-muted-foreground">Loading...</p> : <>
              <div className="flex justify-between"><span>Purchases</span><span>{formatCurrency((data as any)?.expenses?.purchases)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>Total Expenses</span><span className="text-red-600">{formatCurrency((data as any)?.expenses?.total)}</span></div>
            </>}
          </CardContent>
        </Card>
      </div>
      {!isLoading && data && (
        <Card className={(data as any).netProfit >= 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <p className="text-lg font-bold">{(data as any).netProfit >= 0 ? "Net Profit" : "Net Loss"}</p>
              <p className={`text-3xl font-bold ${(data as any).netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(Math.abs((data as any).netProfit))}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
