import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PartyOption { id: number; name: string; }

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = parties.find(p => p.id === value);
  const filtered = parties.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className={cn(
          "w-full h-9 flex items-center justify-between rounded-md border bg-background px-3 text-sm text-left focus:outline-none focus:ring-1 focus:ring-ring",
          hasError ? "border-destructive" : "border-input hover:border-primary/50"
        )}
      >
        <span className={cn("truncate flex-1", !selected && "text-muted-foreground")}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border bg-popover shadow-lg">
          <div className="p-1.5 border-b">
            <input
              autoFocus
              className="w-full h-7 px-2 text-xs rounded border border-input bg-background outline-none"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="text-center py-3 text-xs text-muted-foreground">No parties found</div>
            ) : filtered.map(p => (
              <button
                key={p.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  value === p.id && "bg-accent font-medium"
                )}
                onClick={() => { onChange(p.id); setOpen(false); setSearch(""); }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
