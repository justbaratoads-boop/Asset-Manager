import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListParties, useDeleteParty, getListPartiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { Plus, Search, Eye, Pencil, Trash2, Phone, ShieldCheck, ShieldOff } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

const gstBadge: Record<string, string> = {
  registered:   "bg-green-100 text-green-700 border-green-300",
  unregistered: "bg-gray-100 text-gray-600 border-gray-300",
  composition:  "bg-blue-100 text-blue-700 border-blue-300",
};

export default function PartiesList() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const { data: parties = [], isLoading } = useListParties({ search: search || undefined });
  const deleteMutation = useDeleteParty();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setPage(1); }, [search, type]);

  const filtered = (parties as any[]).filter((p: any) => type === "all" || p.type === type || p.type === "both");
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
      toast({ title: "Ledger deleted" });
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to delete";
      toast({ title: "Cannot delete", description: msg, variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Ledger</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "ledger" : "ledgers"}</p>
        </div>
        <Link href="/accounts/parties/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Ledger</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search parties..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Parties</SelectItem>
            <SelectItem value="customer">Customers</SelectItem>
            <SelectItem value="supplier">Suppliers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-10">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No parties found</div>
        ) : paginated.map((party: any) => (
          <Card key={party.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base truncate">{party.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{party.accountGroup}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${gstBadge[party.gstType] || ""}`}>
                      {party.gstType === "unregistered" ? <ShieldOff className="h-3 w-3 mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                      {party.gstType}
                    </Badge>
                    {party.city && <span className="text-xs text-muted-foreground">{party.city}, {party.state}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatCurrency(party.openingBalance)}</p>
                  <p className="text-xs text-muted-foreground uppercase">{party.balanceType}</p>
                </div>
              </div>
              {(party.phone || party.gstin) && (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {party.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{party.phone}</span>}
                  {party.gstin && <span className="font-mono">{party.gstin}</span>}
                </div>
              )}
              <div className="flex gap-2 border-t pt-3">
                <Link href={`/accounts/parties/${party.id}/edit`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                </Link>
                <Link href={`/accounts/parties/${party.id}`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full"><Eye className="h-3.5 w-3.5 mr-1" />View</Button>
                </Link>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(party.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="md:hidden">
        <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account Group</TableHead>
                <TableHead>GST Status</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Bal.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No parties found</TableCell></TableRow>
              ) : paginated.map((party: any) => (
                <TableRow key={party.id}>
                  <TableCell>
                    <p className="font-medium">{party.name}</p>
                    {party.gstin && <p className="text-xs font-mono text-muted-foreground">{party.gstin}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{party.accountGroup}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs capitalize ${gstBadge[party.gstType] || ""}`}>
                      {party.gstType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{party.state || "—"}</TableCell>
                  <TableCell className="text-sm">{party.phone || "—"}</TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap">
                    {formatCurrency(party.openingBalance)}
                    <span className="text-muted-foreground uppercase text-xs ml-1">{party.balanceType}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Link href={`/accounts/parties/${party.id}`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="View"><Eye className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Link href={`/accounts/parties/${party.id}/edit`}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(party.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4">
            <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
