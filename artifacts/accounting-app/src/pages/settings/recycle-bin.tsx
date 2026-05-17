import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { Trash2, RotateCcw, Search, Clock, AlertTriangle } from "lucide-react";

interface BinItem {
  id: number;
  type: string;
  title: string;
  subtitle: string | null;
  amount: number | null;
  date: string | null;
  deletedAt: string;
  expiresAt: string;
  daysLeft: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  sale_invoice:     { label: "Sale Invoice",     color: "bg-blue-100 text-blue-700" },
  purchase_invoice: { label: "Purchase Invoice", color: "bg-purple-100 text-purple-700" },
  sale_order:       { label: "Sale Order",        color: "bg-sky-100 text-sky-700" },
  purchase_order:   { label: "Purchase Order",    color: "bg-violet-100 text-violet-700" },
  payment:          { label: "Payment",           color: "bg-orange-100 text-orange-700" },
  receipt:          { label: "Receipt",           color: "bg-green-100 text-green-700" },
  journal:          { label: "Journal",           color: "bg-slate-100 text-slate-700" },
  credit_note:      { label: "Credit Note",       color: "bg-pink-100 text-pink-700" },
  debit_note:       { label: "Debit Note",        color: "bg-red-100 text-red-700" },
  party:            { label: "Party",             color: "bg-teal-100 text-teal-700" },
  stock_item:       { label: "Stock Item",        color: "bg-amber-100 text-amber-700" },
  ledger:           { label: "Ledger",            color: "bg-gray-100 text-gray-700" },
};

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  ...Object.entries(TYPE_CONFIG).map(([v, { label }]) => ({ value: v, label })),
];

export default function RecycleBin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [restoring, setRestoring] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["recycle-bin"],
    queryFn: () => customFetch<{ items: BinItem[] }>("/api/recycle-bin").then(r => r.items),
  });

  const items: BinItem[] = data ?? [];

  const filtered = items.filter(item => {
    const matchType = typeFilter === "all" || item.type === typeFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || item.title.toLowerCase().includes(q) || (item.subtitle ?? "").toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const handleRestore = async (item: BinItem) => {
    const key = `${item.type}-${item.id}`;
    setRestoring(key);
    try {
      await customFetch("/api/recycle-bin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      toast({ title: `Restored: ${item.title}` });
      queryClient.invalidateQueries({ queryKey: ["recycle-bin"] });
      refetch();
    } catch {
      toast({ title: "Restore failed", variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  const urgentCount = items.filter(i => i.daysLeft <= 7).length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Trash2 className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold">Recycle Bin</h1>
          <p className="text-xs text-muted-foreground">Deleted items are permanently removed after 30 days</p>
        </div>
      </div>

      {urgentCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{urgentCount} item{urgentCount > 1 ? "s" : ""} will be permanently deleted within 7 days</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading recycle bin...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trash2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {items.length === 0 ? "Recycle bin is empty" : "No items match your filters"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-0.5">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</p>
          {filtered.map(item => {
            const cfg = TYPE_CONFIG[item.type] ?? { label: item.type, color: "bg-gray-100 text-gray-700" };
            const key = `${item.type}-${item.id}`;
            const isUrgent = item.daysLeft <= 7;
            const isExpiringSoon = item.daysLeft <= 3;

            return (
              <Card key={key} className={`transition-colors ${isExpiringSoon ? "border-red-200" : isUrgent ? "border-amber-200" : ""}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    {/* Left: type badge + title */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="font-mono text-sm font-semibold truncate">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                        {item.date && <span>{formatDate(item.date)}</span>}
                        {item.amount != null && (
                          <span className="font-medium text-foreground">{formatCurrency(item.amount)}</span>
                        )}
                      </div>
                    </div>

                    {/* Right: expiry + restore */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <div className={`flex items-center gap-1 text-xs font-medium ${isExpiringSoon ? "text-red-600" : isUrgent ? "text-amber-600" : "text-muted-foreground"}`}>
                        <Clock className="h-3 w-3" />
                        {item.daysLeft === 0 ? "Expires today" : `${item.daysLeft}d left`}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1"
                        onClick={() => handleRestore(item)}
                        disabled={restoring === key}
                      >
                        <RotateCcw className="h-3 w-3" />
                        {restoring === key ? "Restoring..." : "Restore"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
