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
  const [dropdownStyle, setDropdownStyle] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 240 });
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const display = UNITS.find(u => u.value === value)?.label.match(/\(([^)]+)\)/)?.[1] ?? value;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); updatePosition(); }}
        className={cn(
          "flex items-center justify-between gap-1 w-full border rounded-md px-2 text-sm bg-background hover:bg-muted/50 transition-colors",
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
                placeholder="Search unit…"
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
            ) : (
              filtered.map(u => (
                <button
                  key={u.value}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors",
                    value === u.value && "bg-primary/10 font-medium text-primary"
                  )}
                  onMouseDown={e => {
                    e.preventDefault();
                    onChange(u.value);
                    setOpen(false);
                    setQuery("");
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
