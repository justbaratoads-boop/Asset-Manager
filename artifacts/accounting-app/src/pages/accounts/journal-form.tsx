import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateJournal, useListLedgers, getListJournalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, today } from "@/lib/format";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JLine { ledgerId: number; type: "dr" | "cr"; amount: number; }

export default function JournalForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateJournal();
  const { data: ledgers = [] } = useListLedgers({});
  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JLine[]>([{ ledgerId: 0, type: "dr", amount: 0 }, { ledgerId: 0, type: "cr", amount: 0 }]);

  const totalDr = lines.filter(l => l.type === "dr").reduce((s, l) => s + l.amount, 0);
  const totalCr = lines.filter(l => l.type === "cr").reduce((s, l) => s + l.amount, 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  const updateLine = (index: number, field: keyof JLine, value: any) => {
    setLines(prev => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) { toast({ title: "Entry not balanced", description: "Debit and Credit must be equal", variant: "destructive" }); return; }
    try {
      await createMutation.mutateAsync({ data: { date, narration, totalDebit: totalDr, totalCredit: totalCr, lines: lines.filter(l => l.ledgerId && l.amount > 0) } as any });
      queryClient.invalidateQueries({ queryKey: getListJournalsQueryKey() });
      toast({ title: "Journal entry created" });
      setLocation("/accounts/journal");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/accounts/journal"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">New Journal Entry</h1>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1 col-span-2"><Label>Narration</Label><Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Description of entry" required /></div>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Ledger</TableHead><TableHead>Dr/Cr</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select value={String(line.ledgerId)} onValueChange={v => updateLine(i, "ledgerId", Number(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select ledger" /></SelectTrigger>
                      <SelectContent>{(ledgers as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name} ({l.group})</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={line.type} onValueChange={v => updateLine(i, "type", v)}>
                      <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="dr">Dr</SelectItem><SelectItem value="cr">Cr</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="h-8 text-xs text-right" type="number" value={line.amount || ""} onChange={e => updateLine(i, "amount", Number(e.target.value))} /></TableCell>
                  <TableCell><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines(prev => [...prev, { ledgerId: 0, type: "dr", amount: 0 }])}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
          <div className={`flex justify-between text-sm font-semibold pt-2 border-t ${balanced ? "text-green-600" : "text-red-600"}`}>
            <span>{balanced ? "Balanced" : "Not Balanced - Difference: " + formatCurrency(Math.abs(totalDr - totalCr))}</span>
            <span>Dr: {formatCurrency(totalDr)} / Cr: {formatCurrency(totalCr)}</span>
          </div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending || !balanced}>{createMutation.isPending ? "Saving..." : "Save Journal Entry"}</Button>
    </form>
  );
}
