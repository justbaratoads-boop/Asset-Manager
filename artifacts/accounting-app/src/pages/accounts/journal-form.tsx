import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCreateJournal, useGetJournal, useListLedgers, getListJournalsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, today } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JLine {
  ledgerId: number;
  ledgerName: string;
  drAmount: number;
  crAmount: number;
}

const BLANK_LINE: JLine = { ledgerId: 0, ledgerName: "", drAmount: 0, crAmount: 0 };

function LedgerCombobox({ value, onChange, ledgers }: {
  value: number;
  onChange: (id: number, name: string) => void;
  ledgers: any[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = ledgers.find((l: any) => l.id === value);
  const filtered = ledgers.filter((l: any) =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) || (l.group || "").toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className="w-full h-8 flex items-center justify-between rounded border border-input bg-background px-2.5 text-xs text-left hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={selected ? "" : "text-muted-foreground"}>{selected ? selected.name : "Select ledger..."}</span>
        <Search className="h-3 w-3 text-muted-foreground ml-1 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-64 rounded-md border bg-popover shadow-lg">
          <div className="p-1.5 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                autoFocus
                className="w-full h-7 pl-6 pr-2 text-xs rounded border border-input bg-background outline-none"
                placeholder="Search ledger..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="text-center py-3 text-xs text-muted-foreground">No accounts found</div>
            ) : filtered.map((l: any) => (
              <button
                key={l.id}
                type="button"
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2
                  ${value === l.id ? "bg-accent font-medium" : ""}`}
                onClick={() => { onChange(l.id, l.name); setOpen(false); }}
              >
                <span className="truncate">{l.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{l.group}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function JournalForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateJournal();
  const { data: ledgers = [] } = useListLedgers({});
  const { data: existing } = useGetJournal(editId!, { query: { enabled: isEdit } } as any);

  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JLine[]>([
    { ...BLANK_LINE },
    { ...BLANK_LINE },
  ]);

  useEffect(() => {
    if (!existing) return;
    const e = existing as any;
    setDate(e.date || today());
    setNarration(e.narration || "");
    if (e.lines?.length) {
      // Convert old format (type + amount) → new format (drAmount / crAmount)
      const ledgerList = ledgers as any[];
      const rebuilt: JLine[] = e.lines.map((l: any) => {
        const lInfo = ledgerList.find((x: any) => x.id === l.ledgerId);
        return {
          ledgerId: l.ledgerId || 0,
          ledgerName: lInfo?.name || "",
          drAmount: l.type === "dr" ? Number(l.amount) : 0,
          crAmount: l.type === "cr" ? Number(l.amount) : 0,
        };
      });
      setLines(rebuilt.length > 0 ? rebuilt : [{ ...BLANK_LINE }, { ...BLANK_LINE }]);
    }
  }, [existing, ledgers]);

  const totalDr = lines.reduce((s, l) => s + (l.drAmount || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (l.crAmount || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;

  const updateLine = (index: number, field: keyof JLine, value: any) => {
    setLines(prev => {
      const u = [...prev];
      u[index] = { ...u[index], [field]: value };
      return u;
    });
  };

  const addLine = () => setLines(prev => [...prev, { ...BLANK_LINE }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, j) => j !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) {
      toast({ title: "Entry not balanced", description: "Total debit must equal total credit", variant: "destructive" });
      return;
    }
    // Flatten each line into individual Dr / Cr journal lines
    const flatLines: { ledgerId: number; type: "dr" | "cr"; amount: number }[] = [];
    for (const l of lines) {
      if (l.drAmount > 0 && l.ledgerId) flatLines.push({ ledgerId: l.ledgerId, type: "dr", amount: l.drAmount });
      if (l.crAmount > 0 && l.ledgerId) flatLines.push({ ledgerId: l.ledgerId, type: "cr", amount: l.crAmount });
    }
    if (flatLines.length < 2) {
      toast({ title: "Incomplete entry", description: "Please fill at least one Dr and one Cr line", variant: "destructive" });
      return;
    }
    const payload = {
      date, narration,
      totalDebit: totalDr,
      totalCredit: totalCr,
      lines: flatLines.map(l => ({ ...l, partyId: null })),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/accounts/journal">
          <Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        </Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Journal Entry" : "New Journal Entry"}</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-5">
          {/* Date */}
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
            </div>
          </div>

          {/* Lines table */}
          <div>
            <div className="grid grid-cols-[1fr_120px_120px_32px] gap-x-2 items-center mb-1.5 px-0.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ledger Account</span>
              <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide text-right">Dr (₹)</span>
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide text-right">Cr (₹)</span>
              <span></span>
            </div>

            <div className="space-y-1.5">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_120px_32px] gap-x-2 items-center">
                  <LedgerCombobox
                    value={line.ledgerId}
                    onChange={(id, name) => {
                      updateLine(i, "ledgerId", id);
                      updateLine(i, "ledgerName", name);
                    }}
                    ledgers={ledgers as any[]}
                  />
                  <Input
                    className="h-8 text-xs text-right"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={line.drAmount || ""}
                    onChange={e => {
                      updateLine(i, "drAmount", Number(e.target.value));
                      if (Number(e.target.value) > 0) updateLine(i, "crAmount", 0);
                    }}
                  />
                  <Input
                    className="h-8 text-xs text-right"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={line.crAmount || ""}
                    onChange={e => {
                      updateLine(i, "crAmount", Number(e.target.value));
                      if (Number(e.target.value) > 0) updateLine(i, "drAmount", 0);
                    }}
                  />
                  <button
                    type="button"
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => removeLine(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_120px_120px_32px] gap-x-2 items-center mt-2 pt-2 border-t">
              <span className={`text-xs font-semibold ${balanced ? "text-green-600" : totalDr > 0 || totalCr > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                {balanced ? "✓ Balanced" : totalDr > 0 || totalCr > 0 ? `Difference: ${formatCurrency(Math.abs(totalDr - totalCr))}` : "Enter amounts above"}
              </span>
              <span className="text-right text-xs font-bold text-sky-700">{formatCurrency(totalDr)}</span>
              <span className="text-right text-xs font-bold text-rose-700">{formatCurrency(totalCr)}</span>
              <span></span>
            </div>
          </div>

          {/* Add Line */}
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Add Line
          </Button>

          {/* Narration */}
          <div className="space-y-1">
            <Label>Narration</Label>
            <Input
              value={narration}
              onChange={e => setNarration(e.target.value)}
              placeholder="Description of this journal entry..."
              required
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={createMutation.isPending || !balanced}>
        {createMutation.isPending ? "Saving..." : isEdit ? "Update Journal Entry" : "Save Journal Entry"}
      </Button>
    </form>
  );
}
