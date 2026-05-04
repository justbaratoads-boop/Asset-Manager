import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCreateJournal, useGetJournal, useListLedgers, useListParties, getListJournalsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, today } from "@/lib/format";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JLine { ledgerId: number; partyId?: number; type: "dr" | "cr"; amount: number; }

export default function JournalForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateJournal();
  const { data: ledgers = [] } = useListLedgers({});
  const { data: parties = [] } = useListParties();
  const { data: existing } = useGetJournal(editId!, { query: { enabled: isEdit } });

  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JLine[]>([
    { ledgerId: 0, partyId: undefined, type: "dr", amount: 0 },
    { ledgerId: 0, partyId: undefined, type: "cr", amount: 0 },
  ]);

  useEffect(() => {
    if (!existing) return;
    const e = existing as any;
    setDate(e.date || today());
    setNarration(e.narration || "");
    if (e.lines?.length) {
      setLines(e.lines.map((l: any) => ({
        ledgerId: l.ledgerId || 0,
        partyId: l.partyId || undefined,
        type: l.type || "dr",
        amount: Number(l.amount) || 0,
      })));
    }
  }, [existing]);

  const totalDr = lines.filter(l => l.type === "dr").reduce((s, l) => s + l.amount, 0);
  const totalCr = lines.filter(l => l.type === "cr").reduce((s, l) => s + l.amount, 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01;

  const updateLine = (index: number, field: keyof JLine, value: any) => {
    setLines(prev => {
      const u = [...prev];
      u[index] = { ...u[index], [field]: value };
      return u;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) {
      toast({ title: "Entry not balanced", description: "Debit and Credit must be equal", variant: "destructive" });
      return;
    }
    const validLines = lines.filter(l => l.ledgerId && l.amount > 0);
    const payload = {
      date, narration,
      totalDebit: totalDr,
      totalCredit: totalCr,
      lines: validLines.map(l => ({
        ledgerId: l.ledgerId,
        partyId: l.partyId || null,
        type: l.type,
        amount: l.amount,
      })),
    };
    try {
      if (isEdit) {
        await customFetch(`/api/journals/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Journal entry updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Journal entry created" });
      }
      queryClient.invalidateQueries({ queryKey: getListJournalsQueryKey() });
      setLocation("/accounts/journal");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const partyOptions = (parties as any[]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/accounts/journal"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Journal Entry" : "New Journal Entry"}</h1>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="space-y-1 col-span-2"><Label>Narration</Label><Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Description of entry" required /></div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Ledger Account</TableHead>
                  <TableHead className="min-w-[160px]">Party <span className="text-muted-foreground font-normal">(optional)</span></TableHead>
                  <TableHead className="w-24">Dr/Cr</TableHead>
                  <TableHead className="text-right w-32">Amount</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={String(line.ledgerId)} onValueChange={v => updateLine(i, "ledgerId", Number(v))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select ledger" /></SelectTrigger>
                        <SelectContent>
                          {(ledgers as any[]).map((l: any) => (
                            <SelectItem key={l.id} value={String(l.id)}>{l.name} <span className="text-muted-foreground">({l.group})</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={line.partyId ? String(line.partyId) : "none"}
                        onValueChange={v => updateLine(i, "partyId", v === "none" ? undefined : Number(v))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No party" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none"><span className="text-muted-foreground">— No party —</span></SelectItem>
                          {partyOptions.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name} <span className="text-muted-foreground capitalize">({p.type})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={line.type} onValueChange={v => updateLine(i, "type", v)}>
                        <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="dr">Dr</SelectItem><SelectItem value="cr">Cr</SelectItem></SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input className="h-8 text-xs text-right" type="number" value={line.amount || ""} onChange={e => updateLine(i, "amount", Number(e.target.value))} />
                    </TableCell>
                    <TableCell>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setLines(prev => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines(prev => [...prev, { ledgerId: 0, partyId: undefined, type: "dr", amount: 0 }])}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Line
          </Button>
          <div className={`flex justify-between text-sm font-semibold pt-2 border-t ${balanced ? "text-green-600" : "text-red-600"}`}>
            <span>{balanced ? "✓ Balanced" : "Not Balanced — Difference: " + formatCurrency(Math.abs(totalDr - totalCr))}</span>
            <span>Dr: {formatCurrency(totalDr)} / Cr: {formatCurrency(totalCr)}</span>
          </div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending || !balanced}>
        {createMutation.isPending ? "Saving..." : isEdit ? "Update Journal Entry" : "Save Journal Entry"}
      </Button>
    </form>
  );
}
