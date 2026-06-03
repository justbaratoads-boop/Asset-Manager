import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Calculator, FileWarning } from "lucide-react";
import { useFY } from "@/lib/financial-year";

export default function InterestCalculationReport() {
  const [, setLocation] = useLocation();
  const { globalFrom, globalTo } = useFY();
  
  const searchParams = new URLSearchParams(window.location.search);
  const partyId = searchParams.get("partyId");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [fromDate, setFromDate] = useState(globalFrom);
  const [toDate, setToDate] = useState(globalTo);

  const fetchInterest = async () => {
    if (!partyId) return;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ partyId, from: fromDate, to: toDate }).toString();
      const res = await customFetch(`/api/reports/interest-calculation?${qs}`);
      setData(res);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to load interest calculation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterest();
  }, [partyId]);

  if (!partyId) {
    return <div className="p-8 text-center text-muted-foreground">Party ID is required</div>;
  }

  const handlePostEntry = () => {
    if (!data?.party?.id) return;
    const amount = data.totalInterest;
    const qs = new URLSearchParams({
      partyId: data.party.id,
      interestAmount: String(amount),
      reason: "interest"
    }).toString();
    setLocation(`/accounts/debit-notes/new?${qs}`);
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <h1 className="text-xl font-bold">Interest Calculation Report</h1>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label>From Date</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To Date</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <Button onClick={fetchInterest} disabled={loading}><Calculator className="h-4 w-4 mr-2" /> Calculate</Button>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <FileWarning className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      ) : loading ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Calculating interest...</CardContent></Card>
      ) : data ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm bg-muted/30">
              <div><span className="text-muted-foreground">Party: </span><span className="font-bold">{data.party.name}</span></div>
              <div><span className="text-muted-foreground">Rate: </span><span className="font-semibold">{data.party.interestRate}%</span> p.a.</div>
              <div><span className="text-muted-foreground">Grace Period: </span><span className="font-semibold">{data.party.interestGracePeriod}</span> days</div>
              <div><span className="text-muted-foreground">Mode: </span><span className="font-semibold">{data.party.interestByTransaction ? "Transaction by Transaction" : "Running Balance"}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {data.party.interestByTransaction ? (
                      <>
                        <TableHead>Txn Date</TableHead>
                        <TableHead>Particulars</TableHead>
                        <TableHead className="text-right">Overdue Amount</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead className="text-right">Interest (Rs)</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead className="text-right">Dr Balance</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead className="text-right">Interest (Rs)</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.calculationLines?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No interest accrued in this period</TableCell></TableRow>
                  ) : (
                    data.calculationLines?.map((line: any, i: number) => (
                      <TableRow key={i}>
                        {data.party.interestByTransaction ? (
                          <>
                            <TableCell>{formatDate(line.date)}</TableCell>
                            <TableCell>{line.particulars}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(line.amount)}</TableCell>
                            <TableCell className="text-right">{line.days}</TableCell>
                            <TableCell className="text-right">{line.interestAmount?.toFixed(2)}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{formatDate(line.fromDate)}</TableCell>
                            <TableCell>{formatDate(line.toDate)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(line.amount)}</TableCell>
                            <TableCell className="text-right">{line.days}</TableCell>
                            <TableCell className="text-right">{line.interestAmount?.toFixed(2)}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                  {data.calculationLines?.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4} className="text-right">Total Interest:</TableCell>
                      <TableCell className="text-right text-red-600">{data.rawInterest?.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                  {data.calculationLines?.length > 0 && (
                    <TableRow className="bg-muted/80 font-bold text-base">
                      <TableCell colSpan={4} className="text-right">Rounded Total:</TableCell>
                      <TableCell className="text-right text-red-700">{formatCurrency(data.totalInterest)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.totalInterest > 0 && (
            <div className="flex justify-end pt-2">
              <Button onClick={handlePostEntry}>Post Interest (Debit Note)</Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
