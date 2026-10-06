import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const UNITS = [
  { label: "N/A (Non Applicable)", value: "n/a" },
  { label: "BAGS (Bag)", value: "bag" },
  { label: "BOTTLES (Btl)", value: "btl" },
  { label: "BOX (Box)", value: "box" },
  { label: "BUNDLES (Bdl)", value: "bdl" },
  { label: "CANS (Can)", value: "can" },
  { label: "CARTONS (Ctn)", value: "ctn" },
  { label: "DOZENS (Dzn)", value: "dzn" },
  { label: "GRAMMES (Gm)", value: "gm" },
  { label: "KILOGRAMS (Kg)", value: "kg" },
  { label: "LITRE (Ltr)", value: "ltr" },
  { label: "METERS (Mtr)", value: "mtr" },
  { label: "MILILITRE (Ml)", value: "ml" },
  { label: "NUMBERS (Nos)", value: "nos" },
  { label: "PACKS (Pac)", value: "pac" },
  { label: "PAIRS (Prs)", value: "prs" },
  { label: "PIECES (Pcs)", value: "pcs" },
  { label: "QUINTAL (Qtl)", value: "qtl" },
  { label: "ROLLS (Rol)", value: "rol" },
  { label: "SQUARE FEET (Sqf)", value: "sqf" },
  { label: "SQUARE METERS (Sqm)", value: "sqm" },
  { label: "TABLETS (Tbs)", value: "tbs" },
];

interface UnitSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function UnitSelect({ value, onChange, className }: UnitSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownStyle, setDropdownStyle] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 240 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 280;

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setDropdownStyle({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: Math.max(rect.width, 240),
        });
      } else {
        setDropdownStyle({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 240),
        });
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        const portal = document.getElementById("unit-select-portal");
        if (portal && portal.contains(e.target as Node)) return;
        setOpen(false);
        setQuery("");
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const filtered = UNITS.filter(u =>
    u.label.toLowerCase().includes(query.toLowerCase()) ||
    u.value.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open && filtered.length > 0) {
      const currentIdx = filtered.findIndex(u => u.value === value);
      setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [query, open, filtered.length, value]);

  useEffect(() => {
    if (open && highlightedIndex >= 0 && listRef.current) {
      const itemEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (itemEl && typeof itemEl.scrollIntoView === "function") {
        itemEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      setQuery("");
      updatePosition();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault();
        onChange(filtered[highlightedIndex].value);
        setOpen(false);
        setQuery("");
        setHighlightedIndex(-1);
        triggerRef.current?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      setHighlightedIndex(-1);
      triggerRef.current?.focus();
    }
  };

  const display = UNITS.find(u => u.value === value)?.label.match(/\(([^)]+)\)/)?.[1] ?? value;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen(o => !o); updatePosition(); }}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex items-center justify-between gap-1 w-full border rounded-md px-2 text-sm bg-background hover:bg-muted/50 transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
          className
        )}
      >
        <span className={cn("truncate", value ? "text-foreground" : "text-muted-foreground")}>
          {display || "Unit"}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      {open && createPortal(
        <div
          id="unit-select-portal"
          className="fixed z-[9999] bg-background border rounded-md shadow-lg w-60 flex flex-col overflow-hidden"
          style={{
            top: dropdownStyle.top !== undefined ? `${dropdownStyle.top}px` : "auto",
            bottom: dropdownStyle.bottom !== undefined ? `${dropdownStyle.bottom}px` : "auto",
            left: `${dropdownStyle.left}px`,
            width: `${dropdownStyle.width}px`
          }}
        >
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search unit…"
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div ref={listRef} className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
            ) : (
              filtered.map((u, idx) => (
                <button
                  key={u.value}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer",
                    idx === highlightedIndex ? "bg-accent text-accent-foreground font-medium" : value === u.value ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                  )}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={e => {
                    e.preventDefault();
                    onChange(u.value);
                    setOpen(false);
                    setQuery("");
                    setHighlightedIndex(-1);
                    triggerRef.current?.focus();
                  }}
                >
                  {u.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
