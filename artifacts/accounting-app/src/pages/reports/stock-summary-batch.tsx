import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatQty } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { useFY } from "@/lib/financial-year";
import { useFetch } from "@/hooks/use-fetch";
import { Layers, Package, ArrowDownCircle, ArrowUpCircle, TrendingUp, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchRow {
  batchId: number | null;
  batchName: string | null;
  expiryDate: string | null;
  openingQty: number;
  openingRate: number;
  openingValue: number;
  inwardQty: number;
  inwardRate: number;
  inwardValue: number;
  outwardQty: number;
  outwardRate: number;
  outwardValue: number;
  closingQty: number;
  closingRate: number;
  closingValue: number;
}

interface ItemGroup {
  itemId: number;
  itemName: string;
  unit: string;
  hsnCode?: string;
  rows: BatchRow[];
}

interface Transaction {
  date: string;
  type: string;
  number: string;
  sourceId: number;
  party: string;
  inQty: number;
  outQty: number;
  rate: number;
  value: number;
  balance: number;
}

interface LedgerData {
  item: { id: number; name: string; unit: string; purchaseRate: number; saleRate: number };
  batch: { id: number; name: string; expiryDate?: string; openingStock: number; physicalStock: number } | null;
  summary: {
    openingQty: number; openingRate: number; openingValue: number;
    inwardQty: number;  inwardRate: number;  inwardValue: number;
    outwardQty: number; outwardRate: number; outwardValue: number;
    closingQty: number; closingRate: number; closingValue: number;
  };
  transactions: Transaction[];
}

interface SelectedRow {
  itemId: number;
  itemName: string;
  batchId: number | null;
  batchName: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt2   = (n: number) => Number(n || 0).toFixed(2);
const fmtRate = (n: number) => n > 0 ? `₹${Number(n).toFixed(2)}` : "—";

const TYPE_META: Record<string, { color: string; badge: string }> = {
  "Purchase Invoice": { color: "text-blue-700",  badge: "bg-blue-50 text-blue-700 border-blue-200" },
  "Sale Invoice":     { color: "text-green-700", badge: "bg-green-50 text-green-700 border-green-200" },
  "Credit Note":      { color: "text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  "Debit Note":       { color: "text-rose-700",  badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

// ─── Batch Ledger Sheet ────────────────────────────────────────────────────────

function BatchLedgerSheet({
  selected,
  from,
  to,
  onClose,
}: {
  selected: SelectedRow | null;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const batchIdParam = selected?.batchId !== null ? String(selected?.batchId) : "null";
  const url = selected
    ? `/api/reports/stock-batch-ledger?itemId=${selected.itemId}&batchId=${batchIdParam}&from=${from}&to=${to}`
    : null;

  const { data, isLoading } = useFetch<LedgerData>(url ?? "", !!selected);

  const s = data?.summary;
  const txns = data?.transactions ?? [];

  const sheetTitle = selected
    ? selected.batchId !== null
      ? `${selected.itemName} — ${selected.batchName}`
      : `${selected.itemName} — Main Stock`
    : "";

  return (
    <Sheet open={!!selected} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
              {selected?.batchId !== null ? (
                <Layers className="h-5 w-5 text-primary" />
              ) : (
                <Package className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <SheetTitle className="text-base font-bold leading-tight">{sheetTitle}</SheetTitle>
              {data?.batch?.expiryDate && (
                <p className="text-xs text-muted-foreground mt-0.5">Expiry: {data.batch.expiryDate}</p>
              )}
              {(from || to) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Period: {from || "—"} to {to || "—"}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading...</div>
        ) : !data ? null : (
          <div className="px-6 py-5 space-y-5">

            {/* Summary grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                label="Opening Stock"
                qty={s!.openingQty}
                rate={s!.openingRate}
                value={s!.openingValue}
                unit={data.item.unit}
                color="text-slate-700"
              />
              <SummaryCard
                label="Inward"
                qty={s!.inwardQty}
                rate={s!.inwardRate}
                value={s!.inwardValue}
                unit={data.item.unit}
                color="text-blue-700"
                icon={<ArrowDownCircle className="h-4 w-4 text-blue-400" />}
              />
              <SummaryCard
                label="Outward"
                qty={s!.outwardQty}
                rate={s!.outwardRate}
                value={s!.outwardValue}
                unit={data.item.unit}
                color="text-green-700"
                icon={<ArrowUpCircle className="h-4 w-4 text-green-400" />}
              />
              <SummaryCard
                label="Closing Stock"
                qty={s!.closingQty}
                rate={s!.closingRate}
                value={s!.closingValue}
                unit={data.item.unit}
                color="text-primary"
                icon={<TrendingUp className="h-4 w-4 text-primary" />}
                bold
              />
            </div>

            <Separator />

            {/* Transactions table */}
            <div>
              <p className="text-sm font-semibold mb-3">Transaction History</p>
              {txns.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                  No transactions in this period
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-muted/30">
                        <TableHead className="min-w-[90px]">Date</TableHead>
                        <TableHead className="min-w-[120px]">Type</TableHead>
                        <TableHead className="min-w-[110px]">Number</TableHead>
                        <TableHead className="min-w-[130px]">Party</TableHead>
                        <TableHead className="text-right min-w-[70px]">In Qty</TableHead>
                        <TableHead className="text-right min-w-[70px]">Out Qty</TableHead>
                        <TableHead className="text-right min-w-[80px]">Rate</TableHead>
                        <TableHead className="text-right min-w-[90px]">Value</TableHead>
                        <TableHead className="text-right min-w-[80px] font-bold">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Opening row */}
                      <TableRow className="bg-slate-50/60 text-xs text-muted-foreground">
                        <TableCell colSpan={4} className="font-medium text-slate-600 italic">Opening Balance</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right">{fmtRate(s!.openingRate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s!.openingValue)}</TableCell>
                        <TableCell className="text-right font-bold text-slate-700">{formatQty(s!.openingQty, data.item.unit)}</TableCell>
                      </TableRow>

                      {txns.map((t, i) => {
                        const meta = TYPE_META[t.type] || { color: "", badge: "" };
                        return (
                          <TableRow key={i} className="text-sm hover:bg-muted/20">
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{t.date}</TableCell>
                            <TableCell>
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${meta.badge}`}>
                                {t.type}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{t.number}</TableCell>
                            <TableCell className="text-xs max-w-[130px] truncate">{t.party}</TableCell>
                            <TableCell className="text-right text-blue-700 font-medium">
                              {t.inQty > 0 ? formatQty(t.inQty, data.item.unit) : ""}
                            </TableCell>
                            <TableCell className="text-right text-green-700 font-medium">
                              {t.outQty > 0 ? formatQty(t.outQty, data.item.unit) : ""}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{fmtRate(t.rate)}</TableCell>
                            <TableCell className={`text-right font-medium ${meta.color}`}>
                              {formatCurrency(t.value)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              <span className={t.balance < 0 ? "text-red-600" : ""}>
                                {formatQty(t.balance, data.item.unit)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Closing row */}
                      <TableRow className="bg-primary/5 font-semibold text-sm border-t-2">
                        <TableCell colSpan={4} className="text-primary">Closing Balance</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right">{fmtRate(s!.closingRate)}</TableCell>
                        <TableCell className="text-right text-primary">{formatCurrency(s!.closingValue)}</TableCell>
                        <TableCell className="text-right text-primary font-bold">{formatQty(s!.closingQty, data.item.unit)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SummaryCard({
  label, qty, rate, value, unit, color, icon, bold,
}: {
  label: string; qty: number; rate: number; value: number;
  unit: string; color: string; icon?: React.ReactNode; bold?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${bold ? "border-primary/30 bg-primary/5" : "bg-muted/20"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className={`text-lg font-bold ${color}`}>{fmt2(qty)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></p>
      <p className="text-xs text-muted-foreground">{formatCurrency(value)}{rate > 0 ? ` @ ₹${fmt2(rate)}` : ""}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StockSummaryBatch() {
  const { fy, globalFrom: from, globalTo: to, setGlobalFrom, setGlobalTo } = useFY();
  
  
  const [selected, setSelected] = useState<SelectedRow | null>(null);

  const { data, isLoading } = useFetch<{ items: ItemGroup[] }>(
    `/api/reports/stock-summary-batch?from=${from || ""}&to=${to || ""}`
  );

  const items: ItemGroup[] = data?.items || [];
  const totalClosingValue  = items.reduce((s, item) => s + item.rows.reduce((rs, r) => rs + r.closingValue,  0), 0);
  const totalInwardValue   = items.reduce((s, item) => s + item.rows.reduce((rs, r) => rs + r.inwardValue,   0), 0);
  const totalOutwardValue  = items.reduce((s, item) => s + item.rows.reduce((rs, r) => rs + r.outwardValue,  0), 0);

  // Flatten rows for export
  const exportRows = items.flatMap(item =>
    item.rows.map(r => ({
      "Item": item.itemName, "Unit": item.unit,
      "Batch": r.batchName || "(Main Stock)", "Expiry": r.expiryDate || "",
      "Open Qty": fmt2(r.openingQty), "Open Rate": fmt2(r.openingRate), "Open Value": fmt2(r.openingValue),
      "Inward Qty": fmt2(r.inwardQty), "Inward Rate": fmt2(r.inwardRate), "Inward Value": fmt2(r.inwardValue),
      "Outward Qty": fmt2(r.outwardQty), "Outward Rate": fmt2(r.outwardRate), "Outward Value": fmt2(r.outwardValue),
      "Closing Qty": fmt2(r.closingQty), "Closing Rate": fmt2(r.closingRate), "Closing Value": fmt2(r.closingValue),
    }))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Batch-wise Stock Summary</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Average cost valuation · {items.length} items · click any row to see full transaction detail
          </p>
        </div>
        <ExportButtons
          data={exportRows}
          columns={Object.keys(exportRows[0] || {}).map(k => ({ key: k, header: k }))}
          filename={`batch-stock-summary-${from}-${to}`}
          title="Batch-wise Stock Summary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label>From</Label>
          <Input type="date" value={from} onChange={e => setGlobalFrom(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <Label>To</Label>
          <Input type="date" value={to} onChange={e => setGlobalTo(e.target.value)} className="w-36" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Inward Value</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalInwardValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Outward Value</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalOutwardValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Closing Stock Value</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalClosingValue)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="w-40 min-w-[160px]">Stock Item</TableHead>
                <TableHead className="min-w-[120px]">Batch</TableHead>
                <TableHead className="text-right min-w-[72px]">Open Qty</TableHead>
                <TableHead className="text-right min-w-[80px]">Open Rate</TableHead>
                <TableHead className="text-right min-w-[90px]">Open Value</TableHead>
                <TableHead className="text-right min-w-[72px]">In Qty</TableHead>
                <TableHead className="text-right min-w-[80px]">In Rate</TableHead>
                <TableHead className="text-right min-w-[90px]">In Value</TableHead>
                <TableHead className="text-right min-w-[72px]">Out Qty</TableHead>
                <TableHead className="text-right min-w-[80px]">Out Rate</TableHead>
                <TableHead className="text-right min-w-[90px]">Out Value</TableHead>
                <TableHead className="text-right min-w-[72px] font-bold">Close Qty</TableHead>
                <TableHead className="text-right min-w-[80px] font-bold">Close Rate</TableHead>
                <TableHead className="text-right min-w-[90px] font-bold">Close Value</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={15} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center py-10 text-muted-foreground">No stock items found</TableCell></TableRow>
              ) : (
                items.map(item => {
                  const isBatched = item.rows.length > 1 || (item.rows.length === 1 && item.rows[0].batchId !== null);
                  return item.rows.map((row, ri) => {
                    const isFirst = ri === 0;
                    const isSelected =
                      selected?.itemId === item.itemId &&
                      selected?.batchId === row.batchId;

                    return (
                      <TableRow
                        key={`${item.itemId}-${row.batchId ?? "main"}`}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 hover:bg-primary/15"
                            : isBatched && row.batchId !== null
                              ? "bg-muted/30 hover:bg-muted/50"
                              : isBatched && row.batchId === null
                                ? "bg-blue-50/40 hover:bg-blue-50/70"
                                : "hover:bg-muted/40"
                        }`}
                        onClick={() =>
                          setSelected({
                            itemId: item.itemId,
                            itemName: item.itemName,
                            batchId: row.batchId,
                            batchName: row.batchName,
                          })
                        }
                      >
                        {/* Item name — only on first row */}
                        <TableCell className="font-medium text-sm max-w-[160px]">
                          {isFirst ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="truncate">{item.itemName}</span>
                              {item.unit && <span className="text-[10px] text-muted-foreground">{item.unit}</span>}
                            </div>
                          ) : null}
                        </TableCell>

                        {/* Batch name */}
                        <TableCell className="text-sm">
                          {row.batchId !== null ? (
                            <div className="flex flex-col gap-0.5 pl-3">
                              <span className="font-medium flex items-center gap-1">
                                <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                                {row.batchName}
                              </span>
                              {row.expiryDate && (
                                <span className="text-[10px] text-muted-foreground">Exp: {row.expiryDate}</span>
                              )}
                            </div>
                          ) : (
                            isBatched
                              ? <span className="text-xs text-muted-foreground pl-3 italic">Main (unbatched)</span>
                              : <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Opening */}
                        <TableCell className="text-right text-sm">{formatQty(row.openingQty, item.unit)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{fmtRate(row.openingRate)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(row.openingValue)}</TableCell>

                        {/* Inward */}
                        <TableCell className="text-right text-sm text-blue-700">{row.inwardQty > 0 ? formatQty(row.inwardQty, item.unit) : "—"}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{fmtRate(row.inwardRate)}</TableCell>
                        <TableCell className="text-right text-sm text-blue-700">{row.inwardValue > 0 ? formatCurrency(row.inwardValue) : "—"}</TableCell>

                        {/* Outward */}
                        <TableCell className="text-right text-sm text-green-700">{row.outwardQty > 0 ? formatQty(row.outwardQty, item.unit) : "—"}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{fmtRate(row.outwardRate)}</TableCell>
                        <TableCell className="text-right text-sm text-green-700">{row.outwardValue > 0 ? formatCurrency(row.outwardValue) : "—"}</TableCell>

                        {/* Closing */}
                        <TableCell className="text-right font-semibold">
                          <div className="flex items-center justify-end gap-1">
                            {formatQty(row.closingQty, item.unit)}
                            {row.closingQty <= 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-red-300 text-red-600">Out</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmtRate(row.closingRate)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(row.closingValue)}</TableCell>

                        {/* Chevron hint */}
                        <TableCell className="text-right pr-3">
                          <ChevronRight className={`h-4 w-4 transition-colors ${isSelected ? "text-primary" : "text-muted-foreground/40"}`} />
                        </TableCell>
                      </TableRow>
                    );
                  });
                })
              )}

              {/* Totals row */}
              {!isLoading && items.length > 0 && (
                <TableRow className="font-bold bg-muted/30 border-t-2">
                  <TableCell colSpan={11}>Total</TableCell>
                  <TableCell className="text-right text-green-700">{formatCurrency(totalOutwardValue)}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">{formatCurrency(totalClosingValue)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BatchLedgerSheet
        selected={selected}
        from={from}
        to={to}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}


