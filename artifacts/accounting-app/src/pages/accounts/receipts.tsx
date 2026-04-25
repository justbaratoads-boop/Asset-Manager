import { useState } from "react";
import { Link } from "wouter";
import { useListReceipts, useDeleteReceipt, getListReceiptsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

export default function ReceiptList() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { data: receipts = [], isLoading } = useListReceipts({});
  const deleteMutation = useDeleteReceipt();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Receipt Vouchers</h1>
        <Link href="/accounts/receipts/new"><Button><Plus className="h-4 w-4 mr-2" />New Receipt</Button></Link>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Voucher#</TableHead><TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : (receipts as any[]).length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No receipts</TableCell></TableRow>
                  : (receipts as any[]).map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.voucherNumber}</TableCell>
                      <TableCell className="text-sm">{formatDate(r.date)}</TableCell>
                      <TableCell>{r.partyName || "-"}</TableCell>
                      <TableCell className="capitalize text-sm">{r.paymentMode?.replace("_", " ")}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{formatCurrency(r.amount)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
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
