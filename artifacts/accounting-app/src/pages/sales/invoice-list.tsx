import { useState, useEffect } from "react";
import { useListSaleInvoices, useDeleteSaleInvoice, getListSaleInvoicesQueryKey, useGetCompanySettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Eye, Pencil, Trash2, Calendar, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

const statusStyles: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
  partial: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUSES = ["all", "confirmed", "partial", "paid", "cancelled"];

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" className={`capitalize text-xs ${statusStyles[status] || ""}`}>{status}</Badge>;
}

function isEdited(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000;
}

export default function SaleInvoiceList() {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const { data: companySettings } = useGetCompanySettings();
  const enableDualLedger = (companySettings as any)?.enableDualLedger ?? false;
  const { data: invoices = [], isLoading } = useListSaleInvoices({ search: search || undefined });
  const deleteMutation = useDeleteSaleInvoice();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, statusFilter, ledgerFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListSaleInvoicesQueryKey() });
    toast({ title: "Invoice deleted" });
    setDeleteId(null);
  };

  const hasFilters = dateFrom || dateTo || statusFilter !== "all" || ledgerFilter !== "all";
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); setLedgerFilter("all"); };

  const list = (invoices as any[]).filter(inv => {
    if (dateFrom && inv.date < dateFrom) return false;
    if (dateTo && inv.date > dateTo) return false;
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    
    if (!enableDualLedger && inv.isKaccha) return false;
    if (enableDualLedger && ledgerFilter === "pakka" && inv.isKaccha) return false;
    if (enableDualLedger && ledgerFilter === "kaccha" && !inv.isKaccha) return false;
    
    return true;
  });
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Sale Invoices</h1>
          <p className="text-sm text-muted-foreground">{list.length} invoices</p>
        </div>
        <Link href="/sales/invoices/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Invoice</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by party name..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-muted/50 border rounded-lg px-3 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs bg-transparent outline-none w-32 cursor-pointer" />
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 border rounded-lg px-3 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs bg-transparent outline-none w-32 cursor-pointer" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/60"}`}>
              {s === "all" ? "All Status" : s}
            </button>
          ))}
        </div>

        {enableDualLedger && (
          <div className="flex gap-1 ml-auto bg-muted/30 p-1 rounded-lg border">
            {["all", "pakka", "kaccha"].map(s => (
              <button
                key={s}
                onClick={() => setLedgerFilter(s)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${ledgerFilter === s ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {hasFilters && (
          <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5" />Clear
          </button>
        )}
      </div>

      {/* Mobile card list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : list.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No invoices found</div>
        ) : paginated.map((inv: any) => (
          <Card key={inv.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-base">{inv.partyName || "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber} · {formatDate(inv.date)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={inv.status} />
                  {isEdited(inv.createdAt, inv.updatedAt) && <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500 border-slate-200">Edited</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold">{formatCurrency(inv.grandTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-semibold text-green-600">{formatCurrency(inv.amountPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-semibold text-red-600">{formatCurrency(inv.balanceDue)}</p>
                </div>
              </div>
              <div className="flex gap-2 border-t pt-3">
                <Link href={`/sales/invoices/${inv.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                <Link href={`/sales/invoices/${inv.id}`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                </Link>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(inv.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4">
        <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Desktop table */}
      

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} title="Delete Invoice?" description="This will permanently delete the invoice." onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
