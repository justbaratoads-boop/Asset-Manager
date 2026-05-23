import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch, useListLedgers, getListJournalsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, today } from "@/lib/format";
import { ArrowLeft, ArrowRight, Search, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Ledger = { id: number; name: string; group: string };

const CASH_BANK_KEYWORDS = ["cash", "bank"];
function isCashBank(group: string) {
  const g = group.toLowerCase();
  return CASH_BANK_KEYWORDS.some(k => g.includes(k));
}

function AccountCombobox({ value, onChange, ledgers, placeholder }: {
  value: { ledgerId: number; ledgerName: string };
  onChange: (id: number, name: string) => void;
  ledgers: Ledger[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = ledgers.find(l => l.id === value.ledgerId);
  const filtered = ledgers.filter(l =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.group.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className="w-full h-10 flex items-center justify-between rounded-md border border-input bg-background px-3 text-sm text-left hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={selected ? "text-foreground font-medium" : "text-muted-foreground"}>
          {selected ? selected.name : placeholder}
        </span>
        <Search className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] rounded-md border bg-popover shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                className="w-full h-8 pl-7 pr-3 text-sm rounded border border-input bg-background outline-none"
                placeholder="Search accounts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">No accounts found</div>
            ) : filtered.map(l => (
              <button
                key={l.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2
                  ${selected?.id === l.id ? "bg-accent font-medium" : ""}`}
                onClick={() => { onChange(l.id, l.name); setOpen(false); setSearch(""); }}
              >
                <span className="truncate font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground shrink-0 bg-muted px-1.5 py-0.5 rounded">{l.group}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContraForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rawLedgers = [] } = useListLedgers({});
  const cashBankLedgers: Ledger[] = (rawLedgers as any[])
    .filter((l: any) => isCashBank(l.group || ""))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  const { data: existing } = useQuery<any>({
    queryKey: ["journal", editId],
    queryFn: () => customFetch(`/api/journals/${editId}`),
    enabled: isEdit,
  });

  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [fromAccount, setFromAccount] = useState<{ ledgerId: number; ledgerName: string }>({ ledgerId: 0, ledgerName: "" });
  const [toAccount, setToAccount] = useState<{ ledgerId: number; ledgerName: string }>({ ledgerId: 0, ledgerName: "" });
  const [saving, setSaving] = useState(false);

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!existing || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    const e = existing as any;
    setDate(e.date || today());
    setNarration(e.narration || "");
    const lines: any[] = e.lines || [];
    const drLine = lines.find((l: any) => l.type === "dr");
    const crLine = lines.find((l: any) => l.type === "cr");
    if (drLine) setToAccount({ ledgerId: drLine.ledgerId, ledgerName: drLine.ledgerName || "" });
    if (crLine) setFromAccount({ ledgerId: crLine.ledgerId, ledgerName: crLine.ledgerName || "" });
    if (drLine) setAmount(Number(drLine.amount));
  }, [existing]);

  const canSave = fromAccount.ledgerId > 0 && toAccount.ledgerId > 0 && amount > 0 && fromAccount.ledgerId !== toAccount.ledgerId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const payload = {
      date,
      narration: narration || `Contra: ${fromAccount.ledgerName} → ${toAccount.ledgerName}`,
      voucherType: "contra",
      totalDebit: amount,
      totalCredit: amount,
      lines: [
        { ledgerId: toAccount.ledgerId,   partyId: null, type: "dr", amount },
        { ledgerId: fromAccount.ledgerId, partyId: null, type: "cr", amount },
      ],
    };
    try {
      if (isEdit) {
        await customFetch(`/api/journals/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Contra voucher updated" });
      } else {
        await customFetch("/api/journals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Contra voucher saved" });
      }
      queryClient.invalidateQueries({ queryKey: [...getListJournalsQueryKey(), "contra"] });
      setLocation("/accounts/contra");
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/accounts/contra">
          <Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{isEdit ? "Edit Contra Voucher" : "New Contra Voucher"}</h1>
          <p className="text-xs text-muted-foreground">Transfer funds between Cash and Bank accounts</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 space-y-6">
          {/* Date */}
          <div className="space-y-1.5 w-48">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {/* Transfer Block */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Transfer</Label>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-start">
              {/* From */}
              <div className="space-y-1.5">
                <Label className="text-xs text-rose-600 font-semibold uppercase tracking-wide">From (Source · Credited)</Label>
                <AccountCombobox
                  value={fromAccount}
                  onChange={(id, name) => setFromAccount({ ledgerId: id, ledgerName: name })}
                  ledgers={cashBankLedgers}
                  placeholder="Select cash / bank account..."
                />
                {cashBankLedgers.length === 0 && (
                  <p className="text-xs text-amber-600">No cash/bank ledgers found. Create them in Chart of Accounts.</p>
                )}
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center pt-6 sm:pt-7">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted border">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* To */}
              <div className="space-y-1.5">
                <Label className="text-xs text-sky-600 font-semibold uppercase tracking-wide">To (Destination · Debited)</Label>
                <AccountCombobox
                  value={toAccount}
                  onChange={(id, name) => setToAccount({ ledgerId: id, ledgerName: name })}
                  ledgers={cashBankLedgers}
                  placeholder="Select cash / bank account..."
                />
              </div>
            </div>

            {/* Same account warning */}
            {fromAccount.ledgerId > 0 && toAccount.ledgerId > 0 && fromAccount.ledgerId === toAccount.ledgerId && (
              <p className="text-xs text-destructive">From and To accounts cannot be the same.</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <div className="relative w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                placeholder="0.00"
                value={amount || ""}
                onChange={e => setAmount(Number(e.target.value))}
                className="pl-7"
              />
            </div>
          </div>

          {/* Summary strip */}
          {canSave && (
            <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
              <ArrowLeftRight className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm">
                <span className="font-semibold text-rose-600">{fromAccount.ledgerName}</span>
                <span className="text-muted-foreground mx-2">→</span>
                <span className="font-semibold text-sky-600">{toAccount.ledgerName}</span>
                <span className="text-muted-foreground mx-2">·</span>
                <span className="font-bold text-primary">{formatCurrency(amount)}</span>
              </p>
            </div>
          )}

          {/* Narration */}
          <div className="space-y-1.5">
            <Label>Narration <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={narration}
              onChange={e => setNarration(e.target.value)}
              placeholder={fromAccount.ledgerName && toAccount.ledgerName
                ? `Contra: ${fromAccount.ledgerName} → ${toAccount.ledgerName}`
                : "Description of this transfer..."}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving || !canSave}>
        {saving ? "Saving..." : isEdit ? "Update Contra Voucher" : "Save Contra Voucher"}
      </Button>
    </form>
  );
}
