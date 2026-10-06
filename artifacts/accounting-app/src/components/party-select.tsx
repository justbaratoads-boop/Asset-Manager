import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useFetch } from "@/hooks/use-fetch";

export interface PartyOption { id: number; name: string; closingBalance?: number | string; }

interface Props {
  value: number | undefined;
  onChange: (id: number) => void;
  parties: PartyOption[];
  placeholder?: string;
  hasError?: boolean;
}

export function PartySelect({ value, onChange, parties, placeholder = "Select party", hasError }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownStyle, setDropdownStyle] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 250;

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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const portal = document.getElementById("party-select-portal");
        if (portal && portal.contains(e.target as Node)) return;
        setOpen(false);
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

  const selected = parties.find(p => p.id === value);
  const shouldFetch = !!(value && selected && selected.closingBalance === undefined);
  const { data: stmt } = useFetch<any>(shouldFetch ? `/api/reports/party-statement?partyId=${value}` : "", shouldFetch);
  const closingBalance = selected?.closingBalance ?? stmt?.closingBalance;
  const filtered = parties.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Initialize or reset highlight on search change or open
  useEffect(() => {
    if (open && filtered.length > 0) {
      const selIdx = filtered.findIndex(p => p.id === value);
      setHighlightedIndex(selIdx >= 0 ? selIdx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [search, open, filtered.length, value]);

  // Scroll highlighted item into view automatically
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
      setSearch("");
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
        const p = filtered[highlightedIndex];
        onChange(p.id);
        setOpen(false);
        setSearch("");
        setHighlightedIndex(-1);
        triggerRef.current?.focus();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch("");
      setHighlightedIndex(-1);
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); updatePosition(); }}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "w-full h-9 flex items-center justify-between rounded-md border bg-background px-3 text-sm text-left focus:outline-none focus:ring-1 focus:ring-ring",
          hasError ? "border-destructive" : "border-input hover:border-primary/50"
        )}
      >
        <span className={cn("truncate flex-1 flex justify-between pr-2 items-center", !selected && "text-muted-foreground")}>
          {selected ? (
            <>
              <span>{selected.name}</span>
              {closingBalance !== undefined && (
                <span className={cn("text-xs font-normal ml-2", Number(closingBalance) < 0 ? "text-red-600" : "text-green-600")}>
                  {formatCurrency(Math.abs(Number(closingBalance)))} {Number(closingBalance) < 0 ? 'Cr' : 'Dr'}
                </span>
              )}
            </>
          ) : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 shrink-0 opacity-50" />
      </button>

      {open && createPortal(
        <div
          id="party-select-portal"
          className="fixed z-[9999] rounded-md border bg-popover shadow-lg overflow-hidden"
          style={{
            top: dropdownStyle.top !== undefined ? `${dropdownStyle.top}px` : "auto",
            bottom: dropdownStyle.bottom !== undefined ? `${dropdownStyle.bottom}px` : "auto",
            left: `${dropdownStyle.left}px`,
            width: `${dropdownStyle.width}px`
          }}
        >
          <div className="p-1.5 border-b">
            <input
              ref={inputRef}
              autoFocus
              className="w-full h-7 px-2 text-xs rounded border border-input bg-background outline-none"
              placeholder="Search party (use ↑ ↓ arrows to navigate, Enter to select)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleInputKeyDown}
            />
          </div>
          <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="text-center py-3 text-xs text-muted-foreground">No parties found</div>
            ) : filtered.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer",
                  idx === highlightedIndex ? "bg-accent text-accent-foreground font-medium" : value === p.id ? "bg-muted font-medium" : "hover:bg-accent/50"
                )}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setSearch("");
                  setHighlightedIndex(-1);
                  triggerRef.current?.focus();
                }}
              >
                <div className="flex justify-between items-center">
                  <span>{p.name}</span>
                  {p.closingBalance !== undefined && (
                    <span className={cn("text-xs font-normal ml-2", Number(p.closingBalance) < 0 ? "text-red-600" : "text-green-600")}>
                      {formatCurrency(Math.abs(Number(p.closingBalance)))} {Number(p.closingBalance) < 0 ? 'Cr' : 'Dr'}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
