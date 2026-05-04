import { useState } from "react";
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
import { Plus, Search, Eye, Pencil, Trash2, Phone } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

const typeStyle: Record<string, string> = {
  customer: "bg-blue-100 text-blue-700",
  supplier: "bg-purple-100 text-purple-700",
  both: "bg-gray-100 text-gray-700",
};

export default function PartiesList() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: parties = [], isLoading } = useListParties({ search: search || undefined });
  const deleteMutation = useDeleteParty();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filtered = (parties as any[]).filter((p: any) => type === "all" || p.type === type || p.type === "both");

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
    setDeleteId(null);
    toast({ title: "Party deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Parties</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} parties</p>
        </div>
        <Link href="/accounts/parties/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Party</Button></Link>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search parties..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
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
        ) : filtered.map((party: any) => (
          <Card key={party.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base truncate">{party.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className={`capitalize text-xs ${typeStyle[party.type] || ""}`}>{party.type}</Badge>
                    {party.city && <span className="text-xs text-muted-foreground">{party.city}</span>}
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
                  <Button size="sm" variant="outline" className="w-full"><Eye className="h-3.5 w-3.5 mr-1" />Ledger</Button>
                </Link>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 px-3" onClick={() => setDeleteId(party.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No parties found</TableCell></TableRow>
              ) : filtered.map((party: any) => (
                <TableRow key={party.id}>
                  <TableCell className="font-medium">{party.name}</TableCell>
                  <TableCell><Badge variant="outline" className={`capitalize ${typeStyle[party.type] || ""}`}>{party.type}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{party.city}</TableCell>
                  <TableCell className="text-xs font-mono">{party.gstin || "-"}</TableCell>
                  <TableCell className="text-sm">{party.phone || "-"}</TableCell>
                  <TableCell className="text-right text-sm">{formatCurrency(party.openingBalance)} <span className="text-muted-foreground uppercase text-xs">{party.balanceType}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/accounts/parties/${party.id}/edit`}><Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button></Link>
                      <Link href={`/accounts/parties/${party.id}`}><Button size="icon" variant="ghost" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button></Link>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(party.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
