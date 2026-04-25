import { useGetCurrentStock } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CurrentStock() {
  const { data: items = [], isLoading } = useGetCurrentStock();

  const total = (items as any[]).reduce((s: number, i: any) => s + i.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Current Stock Report</h1>
        <p className="text-sm text-muted-foreground">Total Value: <span className="font-bold text-foreground">{formatCurrency(total)}</span></p>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Purchase Rate</TableHead>
                <TableHead className="text-right">Sale Rate</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : (items as any[]).length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No items found</TableCell></TableRow>
                  : (items as any[]).map((item: any) => (
                    <TableRow key={item.id} className={cn(item.isLow && "bg-amber-50")}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-xs font-mono">{item.hsnCode || "-"}</TableCell>
                      <TableCell className="text-sm">{item.unit}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(item.purchaseRate)}</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(item.saleRate)}</TableCell>
                      <TableCell className="text-right font-medium">{item.physicalStock}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                      <TableCell>
                        {item.isLow ? (
                          <Badge variant="outline" className="bg-amber-100 text-amber-700 text-xs">Low Stock</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
