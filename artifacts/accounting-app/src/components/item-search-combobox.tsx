import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

interface StockItemOption {
  id: number;
  name: string;
  [key: string]: any;
}

/* ─── Single-select combobox (invoice rows) ─────────────────────── */
interface ItemSearchComboboxProps {
  stockItems: StockItemOption[];
  itemName: string;
  stockItemId?: number;
  onNameChange: (name: string) => void;
  onItemSelect: (item: StockItemOption) => void;
  onClear: () => void;
  onQuickAdd?: () => void;
  placeholder?: string;
  inputClassName?: string;
}

export function ItemSearchCombobox({
  stockItems,
  itemName,
  stockItemId,
  onNameChange,
  onItemSelect,
  onClear,
  onQuickAdd,
  placeholder = "Search item…",
  inputClassName,
}: ItemSearchComboboxProps) {
  const [query, setQuery] = useState(() => (stockItemId ? "" : itemName));
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [dropdownStyle, setDropdownStyle] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync local query with itemName prop when no item is locked
  useEffect(() => {
    if (!stockItemId) {
      setQuery(itemName);
    }
  }, [itemName, stockItemId]);

  const updateDropdownPosition = useCallback(() => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 220;

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setDropdownStyle({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: Math.max(rect.width, 220),
        });
      } else {
        setDropdownStyle({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 220),
        });
      }
    }
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setHighlightedIndex(-1);
        // Discard free-form text — only inventory items are valid
        if (!stockItemId) onNameChange("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [stockItemId, onNameChange]);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);
    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [open, updateDropdownPosition]);

  const filtered = (stockItems || [])
    .filter(s => s.name?.toLowerCase().includes((query || "").toLowerCase()))
    .slice(0, 30);

  // Reset highlight to first item on query change or open
  useEffect(() => {
    if (open && filtered.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [query, open, filtered.length]);

  // Scroll highlighted item into view automatically
  useEffect(() => {
    if (open && highlightedIndex >= 0 && listRef.current) {
      const itemEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (itemEl && typeof itemEl.scrollIntoView === "function") {
        itemEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        updateDropdownPosition();
        setHighlightedIndex(0);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault();
        const selected = filtered[highlightedIndex];
        onItemSelect(selected);
        setQuery("");
        setOpen(false);
        setHighlightedIndex(-1);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  if (stockItemId) {
    return (
      <div className={cn("flex items-center gap-1 h-9 border rounded-md px-2 bg-background", inputClassName)}>
        <span className="flex-1 text-sm truncate">{itemName}</span>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Clear item"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative flex gap-1">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { setOpen(true); updateDropdownPosition(); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pl-7 text-sm", inputClassName)}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setQuery(""); onNameChange(""); setOpen(false); setHighlightedIndex(-1); }}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {onQuickAdd && (
        <Button type="button" size="icon" variant="outline" className={cn("shrink-0", inputClassName?.includes("h-10") ? "h-10 w-10" : "h-9 w-9")} onClick={onQuickAdd}>
          <span className="text-lg leading-none">+</span>
        </Button>
      )}

      {open && createPortal(
        <div
          ref={listRef}
          className="fixed z-[9999] bg-background border rounded-md shadow-lg max-h-52 overflow-y-auto"
          style={{
            top: dropdownStyle.top !== undefined ? `${dropdownStyle.top}px` : "auto",
            bottom: dropdownStyle.bottom !== undefined ? `${dropdownStyle.bottom}px` : "auto",
            left: `${dropdownStyle.left}px`,
            width: `${dropdownStyle.width}px`
          }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {query ? `No items matching "${query}"` : "No items found"}
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer",
                  idx === highlightedIndex ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted"
                )}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onMouseDown={e => {
                  e.preventDefault();
                  onItemSelect(item);
                  setQuery("");
                  setOpen(false);
                  setHighlightedIndex(-1);
                }}
              >
                {item.name}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─── Multi-select search (batch dialog) ────────────────────────── */
interface ItemMultiSearchProps {
  stockItems: StockItemOption[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  placeholder?: string;
}

export function ItemMultiSearch({
  stockItems,
  selectedIds,
  onToggle,
  placeholder = "Search and add items…",
}: ItemMultiSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unselected = (stockItems || []).filter(
    s => !selectedIds.includes(s.id) && s.name?.toLowerCase().includes((query || "").toLowerCase())
  ).slice(0, 30);

  const selectedItems = (stockItems || []).filter(s => selectedIds.includes(s.id));

  useEffect(() => {
    if (open && unselected.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [query, open, unselected.length]);

  useEffect(() => {
    if (open && highlightedIndex >= 0 && listRef.current) {
      const itemEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (itemEl && typeof itemEl.scrollIntoView === "function") {
        itemEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        setHighlightedIndex(0);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (unselected.length === 0) return;
      setHighlightedIndex(prev => (prev < unselected.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (unselected.length === 0) return;
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : unselected.length - 1));
    } else if (e.key === "Enter") {
      if (open && highlightedIndex >= 0 && highlightedIndex < unselected.length) {
        e.preventDefault();
        onToggle(unselected[highlightedIndex].id);
        setQuery("");
        setOpen(false);
        setHighlightedIndex(-1);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-8 text-sm"
          autoComplete="off"
        />
        {open && (
          <div ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {unselected.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {query ? `No results for "${query}"` : selectedIds.length === stockItems.length ? "All items selected" : "No items"}
              </div>
            ) : (
              unselected.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer",
                    idx === highlightedIndex ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted"
                  )}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={e => {
                    e.preventDefault();
                    onToggle(item.id);
                    setQuery("");
                    setOpen(false);
                    setHighlightedIndex(-1);
                  }}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/30 min-h-[2.5rem]">
          {selectedItems.map(item => (
            <Badge key={item.id} variant="secondary" className="text-xs gap-1 pr-1">
              {item.name}
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="hover:text-destructive transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedIds.length === 0 ? "No items selected" : `${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""} selected`}
      </p>
    </div>
  );
}
