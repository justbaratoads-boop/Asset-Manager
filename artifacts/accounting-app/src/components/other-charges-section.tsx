import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { Plus, Trash2, ChevronDown } from "lucide-react";

export interface OtherCharge {
  name?: string;
  ledgerId: number;
  ledgerName: string;
  amount: number;
  type?: "add" | "deduct";
  gstCalculationMethod?: string;
  gstRate?: number;
}

export interface ChargeLedger { id: number; name: string; group: string; gstCalculationMethod?: string; gstRate?: string | null; }

function LedgerSelect({ value, onChange, ledgers }: {
  value: { ledgerId: number; ledgerName: string };
  onChange: (ledgerId: number, ledgerName: string, ledger: ChargeLedger) => void;
  ledgers: ChargeLedger[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 260) });
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        const portal = document.getElementById("ledger-select-portal");
        if (portal && portal.contains(e.target as Node)) return;
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    setTimeout(() => searchRef.current?.focus(), 0);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const selected = ledgers.find(l => l.id === value.ledgerId);
  const filtered = ledgers.filter(l =>
    !search ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.group.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative flex-1 min-w-0" ref={triggerRef}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) setSearch(""); updatePosition(); }}
        className="w-full h-9 flex items-center gap-2 rounded border border-input bg-background px-3 text-sm text-left hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={`flex-1 min-w-0 truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {selected ? selected.name : "Select ledger..."}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && createPortal(
        <div
          id="ledger-select-portal"
          className="fixed z-[9999] rounded-md border bg-popover shadow-lg overflow-hidden"
          style={{ top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width }}
        >
          <div className="p-1.5 border-b">
            <input
              ref={searchRef}
              className="w-full h-8 px-3 text-sm rounded border border-input bg-background outline-none placeholder:text-muted-foreground"
              placeholder="Type to search ledger..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">No ledgers found</div>
            ) : filtered.map(l => (
              <button
                key={l.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-3
                  ${value.ledgerId === l.id ? "bg-accent font-medium" : ""}`}
                onMouseDown={e => {
                  e.preventDefault();
                  onChange(l.id, l.name, l);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <span className="truncate">{l.name}</span>
                <span className="text-xs text-muted-foreground shrink-0 capitalize">{l.group}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface Props {
  charges: OtherCharge[];
  onChange: (charges: OtherCharge[]) => void;
  ledgers?: ChargeLedger[];
}

export function OtherChargesSection({ charges, onChange, ledgers = [] }: Props) {
  const add = () => onChange([...charges, { ledgerId: 0, ledgerName: "", amount: 0, type: "add" }]);
  const remove = (i: number) => onChange(charges.filter((_, j) => j !== i));
  const update = (i: number, partial: Partial<OtherCharge>) => {
    const updated = [...charges];
    updated[i] = { ...updated[i], ...partial };
    onChange(updated);
  };
  const toggleType = (i: number) => {
    const current = charges[i].type ?? "add";
    update(i, { type: current === "add" ? "deduct" : "add" });
  };

  const netTotal = charges.reduce((s, c) => {
    const amt = Number(c.amount) || 0;
    return s + ((c.type ?? "add") === "deduct" ? -amt : amt);
  }, 0);

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
          No additional fields. Click "Add Field" to add freight charges, labour, discounts, etc.
        </p>
      )}

      {charges.map((charge, i) => {
        const isDeduct = (charge.type ?? "add") === "deduct";
        return (
          <div key={i} className="flex flex-wrap gap-2 items-center">

            {/* Ledger selector — takes all available space, min 220px so text is always readable */}
            <div className="flex-1 min-w-[220px]">
              <LedgerSelect
                value={{ ledgerId: charge.ledgerId, ledgerName: charge.ledgerName }}
                onChange={(ledgerId, ledgerName, ledger) => update(i, { 
                  ledgerId, 
                  ledgerName,
                  gstCalculationMethod: ledger?.gstCalculationMethod || "none",
                  gstRate: Number(ledger?.gstRate) || 0
                })}
                ledgers={ledgers}
              />
            </div>

            {/* +Add / −Deduct toggle */}
            <button
              type="button"
              onClick={() => toggleType(i)}
              title={isDeduct ? "Currently deducting — click to switch to Add" : "Currently adding — click to switch to Deduct"}
              className={`h-9 w-20 shrink-0 rounded border text-xs font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-ring
                ${isDeduct
                  ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                  : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                }`}
            >
              {isDeduct ? "− Deduct" : "+ Add"}
            </button>

            {/* Amount */}
            <div className="relative w-28 shrink-0">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none font-medium
                ${isDeduct ? "text-red-500" : "text-muted-foreground"}`}>₹</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={charge.amount || ""}
                onChange={e => update(i, { amount: Number(e.target.value) || 0 })}
                placeholder="0.00"
                className={`pl-7 h-9 text-sm ${isDeduct ? "text-red-600" : ""}`}
              />
            </div>

            {/* Delete */}
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
        );
      })}

      {charges.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-border/50">
          {charges.map((c, i) => {
            const isDeduct = (c.type ?? "add") === "deduct";
            const amt = Number(c.amount) || 0;
            if (amt === 0) return null;
            const label = c.ledgerName || `Field ${i + 1}`;
            return (
              <div key={i} className="flex justify-between text-xs text-muted-foreground">
                <span>{label}</span>
                <span className={isDeduct ? "text-red-600" : "text-green-700"}>
                  {isDeduct ? "− " : "+ "}{formatCurrency(amt)}
                </span>
              </div>
            );
          })}
          <div className={`flex justify-between text-sm font-medium pt-1 border-t border-border/30 ${netTotal < 0 ? "text-red-600" : ""}`}>
            <span className="text-muted-foreground">Net Additional</span>
            <span>{netTotal < 0 ? "− " : netTotal > 0 ? "+ " : ""}{formatCurrency(Math.abs(netTotal))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
