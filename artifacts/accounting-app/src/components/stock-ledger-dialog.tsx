import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { useLocation } from "wouter";

interface StockLedgerDialogProps {
  item: { id: number; name: string } | null;
  onClose: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  "Purchase Invoice": "bg-blue-100 text-blue-700",
  "Sale Invoice": "bg-green-100 text-green-700",
  "Credit Note": "bg-orange-100 text-orange-700",
  "Debit Note": "bg-pink-100 text-pink-700",
};

function navPath(type: string, id: number): string | null {
  switch (type) {
    case "Sale Invoice": return `/sales/invoices/${id}`;
    case "Purchase Invoice": return `/purchase/invoices/${id}/edit`;
    case "Credit Note": return `/accounts/credit-notes/${id}`;
    case "Debit Note": return `/accounts/debit-notes/${id}`;
    default: return null;
  }
}

export function StockLedgerDialog({ item, onClose }: StockLedgerDialogProps) {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["stock-ledger", item?.id],
    queryFn: () => customFetch<any>(`/api/reports/stock-ledger/${item!.id}`),
    enabled: !!item,
  });

  const d = data as any;

  return (
    <Dialog open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Stock Ledger — {item?.name}
            {d?.item?.unit && <span className="ml-2 text-sm font-normal text-muted-foreground">({d.item.unit})</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right text-green-700">In Qty</TableHead>
                  <TableHead className="text-right text-red-700">Out Qty</TableHead>
                  <TableHead className="text-right font-bold">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30 font-medium">
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">Opening Balance</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-bold">{Number(d?.openingQty ?? 0).toFixed(2)}</TableCell>
                </TableRow>
                {!d?.transactions?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  d.transactions.map((t: any, i: number) => {
                    const path = navPath(t.type, t.sourceId);
                    return (
                      <TableRow
                        key={i}
                        className={path ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => { if (path) { onClose(); setLocation(path); } }}
                      >
                        <TableCell className="text-sm">{formatDate(t.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${TYPE_COLORS[t.type] || ""}`}>{t.type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{t.number}</TableCell>
                        <TableCell className="text-sm max-w-[140px] truncate">{t.party || "-"}</TableCell>
                        <TableCell className="text-right text-green-700 font-medium">
                          {t.inQty > 0 ? Number(t.inQty).toFixed(2) : ""}
                        </TableCell>
                        <TableCell className="text-right text-red-700 font-medium">
                          {t.outQty > 0 ? Number(t.outQty).toFixed(2) : ""}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {Number(t.balance).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {d?.transactions?.length > 0 && (
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell colSpan={4}>Closing Balance</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right">{Number(d?.closingQty ?? 0).toFixed(2)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
