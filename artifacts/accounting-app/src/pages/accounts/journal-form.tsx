import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCreateJournal, useGetJournal, useListLedgers, useListParties, getListJournalsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, today } from "@/lib/format";
import { Plus, Trash2, ArrowLeft, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";

interface JLine {
  ledgerId: number;
  partyId: number | null;
  ledgerName: string;
  drAmount: number;
  crAmount: number;
}

const BLANK_LINE: JLine = { ledgerId: 0, partyId: null, ledgerName: "", drAmount: 0, crAmount: 0 };

type Account = { id: number; name: string; group: string; kind: "ledger" | "party" };

function LedgerCombobox({ ledgerId, partyId, onChange, accounts }: {
  ledgerId: number;
  partyId: number | null;
  onChange: (ledgerId: number, partyId: number | null, name: string) => void;
  accounts: Account[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = partyId != null
    ? accounts.find(a => a.kind === "party" && a.id === partyId)
    : accounts.find(a => a.kind === "ledger" && a.id === ledgerId);
  const url = selected?.kind === "party" ? `/api/reports/party-statement?partyId=${selected.id}` : selected?.kind === "ledger" ? `/api/reports/ledger-statement?ledgerId=${selected.id}` : "";
  const { data: stmt } = useFetch<any>(url, !!url);
  const closingBalance = stmt?.closingBalance;

  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.group || "").toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={`relative ${open ? "z-50" : ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className="w-full h-8 flex items-center justify-between rounded border border-input bg-background px-2.5 text-xs text-left hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={selected ? "flex justify-between w-full pr-2 items-center min-w-0" : "text-muted-foreground"}>
          {selected ? (
            <>
              <span className="truncate mr-2 font-medium">{selected.name}</span>
              {closingBalance !== undefined && (
                <span className={`shrink-0 text-[10px] ${Number(closingBalance) < 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}`}>
                  {formatCurrency(Math.abs(Number(closingBalance)))} {Number(closingBalance) < 0 ? 'Cr' : 'Dr'}
                </span>
              )}
            </>
          ) : "Select ledger..."}
        </span>
        <Search className="h-3 w-3 text-muted-foreground ml-1 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-[320px] sm:w-[380px] rounded-md border bg-popover shadow-xl">
          <div className="p-2 border-b bg-muted/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                className="w-full h-8 pl-8 pr-2 text-xs rounded border border-input bg-background outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search ledger or group name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground">No accounts found</div>
            ) : filtered.map((a) => (
              <button
                key={`${a.kind}-${a.id}`}
                type="button"
                className={`w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2 border-b border-border/30 last:border-0
                  ${selected?.id === a.id && selected?.kind === a.kind ? "bg-accent/80 font-semibold text-primary" : ""}`}
                onClick={() => {
                  const newLedgerId = a.kind === "ledger" ? a.id : 0;
                  const newPartyId = a.kind === "party" ? a.id : null;
                  onChange(newLedgerId, newPartyId, a.name);
                  setOpen(false);
                }}
              >
                <span className="truncate font-medium">{a.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded font-mono">{a.group}</span>
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
  const { data: rawLedgers = [] } = useListLedgers({});
  const { data: rawParties = [] } = useListParties();

  const allAccounts = useMemo<Account[]>(() => {
    const list: Account[] = [];
    const seen = new Set<string>();

    if (Array.isArray(rawLedgers)) {
      for (const l of rawLedgers as any[]) {
        if (l.id && l.id < 1000000) {
          const key = `ledger-${l.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({ id: l.id, name: l.name, group: l.group || "General", kind: "ledger" });
          }
        }
      }
    }

    if (Array.isArray(rawParties)) {
      for (const p of rawParties as any[]) {
        if (p.id) {
          const key = `party-${p.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({ id: p.id, name: p.name, group: p.accountGroup || (p.type === "supplier" ? "Sundry Creditors" : "Sundry Debtors"), kind: "party" });
          }
        }
      }
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [rawLedgers, rawParties]);

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
      const rebuilt: JLine[] = e.lines.map((l: any) => {
        const acct = l.partyId
          ? allAccounts.find(a => a.kind === "party" && a.id === l.partyId)
          : allAccounts.find(a => a.kind === "ledger" && a.id === l.ledgerId);
        return {
          ledgerId: l.ledgerId || 0,
          partyId: l.partyId || null,
          ledgerName: acct?.name || "",
          drAmount: l.type === "dr" ? Number(l.amount) : 0,
          crAmount: l.type === "cr" ? Number(l.amount) : 0,
        };
      });
      setLines(rebuilt.length > 0 ? rebuilt : [{ ...BLANK_LINE }, { ...BLANK_LINE }]);
    }
  }, [existing, allAccounts.length]);

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

  const updateLineFields = (index: number, fields: Partial<JLine>) => {
    setLines(prev => {
      const u = [...prev];
      u[index] = { ...u[index], ...fields };
      return u;
    });
  };

  const addLine = () => setLines(prev => [...prev, { ...BLANK_LINE }]);
  const removeLine = (i: number) => setLines(prev => prev.length > 2 ? prev.filter((_, j) => j !== i) : prev);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanced) {
      toast({ title: "Entry not balanced", description: "Total debit must equal total credit", variant: "destructive" });
      return;
    }
    // Flatten each line into individual Dr / Cr journal lines
    const flatLines: { ledgerId: number; partyId: number | null; type: "dr" | "cr"; amount: number }[] = [];
    for (const l of lines) {
      const hasAccount = l.ledgerId > 0 || l.partyId != null;
      if (l.drAmount > 0 && hasAccount) flatLines.push({ ledgerId: l.ledgerId, partyId: l.partyId ?? null, type: "dr", amount: l.drAmount });
      if (l.crAmount > 0 && hasAccount) flatLines.push({ ledgerId: l.ledgerId, partyId: l.partyId ?? null, type: "cr", amount: l.crAmount });
    }
    if (flatLines.length < 2) {
      toast({ title: "Incomplete entry", description: "Please fill at least one Dr and one Cr line", variant: "destructive" });
      return;
    }
    const payload = {
      date, narration,
      totalDebit: totalDr,
      totalCredit: totalCr,
      lines: flatLines,
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
      toast({ title: "Error", description: err?.data?.error || "Failed to save", variant: "destructive" });
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
          <div className="overflow-x-auto -mx-1 px-1 pb-1 min-h-[360px]">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-[1fr_110px_110px_32px] sm:grid-cols-[1fr_120px_120px_32px] gap-x-2 items-center mb-1.5 px-0.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ledger Account</span>
                <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide text-right">Dr (₹)</span>
                <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide text-right">Cr (₹)</span>
                <span></span>
              </div>

              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] sm:grid-cols-[1fr_120px_120px_32px] gap-x-2 items-center relative" style={{ zIndex: lines.length - i }}>
                    <LedgerCombobox
                      ledgerId={line.ledgerId}
                      partyId={line.partyId}
                      onChange={(newLedgerId, newPartyId, name) => {
                        updateLineFields(i, { ledgerId: newLedgerId, partyId: newPartyId, ledgerName: name });
                      }}
                      accounts={allAccounts}
                    />
                    <div className="flex flex-col gap-0.5">
                      <Input
                        className="h-8 text-xs text-right"
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={line.drAmount || ""}
                        onChange={e => {
                          const val = Number(e.target.value);
                          updateLineFields(i, { drAmount: val, crAmount: val > 0 ? 0 : line.crAmount });
                        }}
                      />
                      {line.drAmount % 1 !== 0 && line.drAmount > 0 && (
                        <button type="button" onClick={() => updateLine(i, "drAmount", Math.ceil(line.drAmount))} className="text-[9px] text-primary text-right font-medium hover:underline">↑ Round Up</button>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Input
                        className="h-8 text-xs text-right"
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={line.crAmount || ""}
                        onChange={e => {
                          const val = Number(e.target.value);
                          updateLineFields(i, { crAmount: val, drAmount: val > 0 ? 0 : line.drAmount });
                        }}
                      />
                      {line.crAmount % 1 !== 0 && line.crAmount > 0 && (
                        <button type="button" onClick={() => updateLine(i, "crAmount", Math.ceil(line.crAmount))} className="text-[9px] text-primary text-right font-medium hover:underline">↑ Round Up</button>
                      )}
                    </div>
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
              <div className="grid grid-cols-[1fr_110px_110px_32px] sm:grid-cols-[1fr_120px_120px_32px] gap-x-2 items-center mt-2 pt-2 border-t">
                <span className={`text-xs font-semibold ${balanced ? "text-green-600" : totalDr > 0 || totalCr > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  {balanced ? "✓ Balanced" : totalDr > 0 || totalCr > 0 ? `Difference: ${formatCurrency(Math.abs(totalDr - totalCr))}` : "Enter amounts above"}
                </span>
                <span className="text-right text-xs font-bold text-sky-700">{formatCurrency(totalDr)}</span>
                <span className="text-right text-xs font-bold text-rose-700">{formatCurrency(totalCr)}</span>
                <span></span>
              </div>
            </div>
          </div>

          {/* Add Line */}
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Add Line
          </Button>

          {/* Narration */}
          <div className="space-y-1">
            <Label>Narration (Optional)</Label>
            <Input
              value={narration}
              onChange={e => setNarration(e.target.value)}
              placeholder="Description of this journal entry (optional)..."
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
