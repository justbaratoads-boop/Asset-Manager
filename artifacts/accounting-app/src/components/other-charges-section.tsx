import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { Plus, Trash2, Search } from "lucide-react";

export interface OtherCharge {
  ledgerId: number;
  ledgerName: string;
  amount: number;
}

export interface ChargeLedger { id: number; name: string; group: string; }

function LedgerSelect({ value, onChange, ledgers }: {
  value: { ledgerId: number; ledgerName: string };
  onChange: (ledgerId: number, ledgerName: string) => void;
  ledgers: ChargeLedger[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = ledgers.find(l => l.id === value.ledgerId);
  const filtered = ledgers.filter(l =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.group.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className="w-full h-9 flex items-center justify-between rounded border border-input bg-background px-3 text-sm text-left hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? selected.name : "Select account..."}
        </span>
        <Search className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-md border bg-popover shadow-lg">
          <div className="p-1.5 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                autoFocus
                className="w-full h-7 pl-6 pr-2 text-xs rounded border border-input bg-background outline-none"
                placeholder="Search account..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="text-center py-3 text-xs text-muted-foreground">No accounts found</div>
            ) : filtered.map(l => (
              <button
                key={l.id}
                type="button"
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2
                  ${value.ledgerId === l.id ? "bg-accent font-medium" : ""}`}
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

interface Props {
  charges: OtherCharge[];
  onChange: (charges: OtherCharge[]) => void;
  ledgers: ChargeLedger[];
}

export function OtherChargesSection({ charges, onChange, ledgers }: Props) {
  const add = () => onChange([...charges, { ledgerId: 0, ledgerName: "", amount: 0 }]);
  const remove = (i: number) => onChange(charges.filter((_, j) => j !== i));
  const update = (i: number, field: keyof OtherCharge, value: any) => {
    const updated = [...charges];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };
  const total = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Additional Fields</span>
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-7 text-xs gap-1 px-2">
          <Plus className="h-3.5 w-3.5" />Add Field
        </Button>
      </div>

      {charges.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">
          No additional fields. Click "Add Field" to add freight charges, labour, etc.
        </p>
      )}

      {charges.map((charge, i) => (
        <div key={i} className="flex gap-2 items-center">
          <LedgerSelect
            value={{ ledgerId: charge.ledgerId, ledgerName: charge.ledgerName }}
            onChange={(ledgerId, ledgerName) => {
              update(i, "ledgerId", ledgerId);
              update(i, "ledgerName", ledgerName);
            }}
            ledgers={ledgers}
          />
          <div className="relative w-32 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">₹</span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={charge.amount || ""}
              onChange={e => update(i, "amount", Number(e.target.value) || 0)}
              placeholder="0.00"
              className="pl-7 h-9 text-sm"
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-destructive shrink-0"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {charges.length > 0 && total > 0 && (
        <div className="flex justify-between text-sm font-medium pt-1 border-t border-border/50">
          <span className="text-muted-foreground">Additional Fields Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
}
