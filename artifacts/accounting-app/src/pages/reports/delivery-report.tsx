import { useState } from "react";
import { useGetDeliveryReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { useFY } from "@/lib/financial-year";
import { Truck } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  dispatched: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const columns = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Order#", key: "orderNumber" },
  { header: "Party", key: "partyName" },
  { header: "Driver", key: "driverName" },
  { header: "Vehicle Name", key: "vehicleName" },
  { header: "Vehicle No.", key: "vehicleNo" },
  { header: "Delivery Date", key: "deliveryDate", format: (v: any) => v ? formatDate(v) : "" },
  { header: "Amount", key: "grandTotal", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Status", key: "status" },
];

export default function DeliveryReport() {
  const { fy } = useFY();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const { data, isLoading } = useGetDeliveryReport({ from: from || undefined, to: to || undefined });

  const orders: any[] = (data as any)?.orders || [];
  const vehicleSummary: any[] = (data as any)?.vehicleSummary || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Delivery Report</h1>
        <ExportButtons data={orders} columns={columns} filename={`delivery-report-${from}-${to}`} title="Delivery Report" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
        <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Orders Dispatched</p><p className="text-xl font-bold">{(data as any)?.totalOrders || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Amount</p><p className="text-xl font-bold">{formatCurrency((data as any)?.totalAmount)}</p></CardContent></Card>
      </div>

      {vehicleSummary.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {vehicleSummary.map((v: any) => (
            <Card key={v.vehicle}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm font-semibold">{v.vehicle}</span>
                </div>
                <p className="text-xs text-muted-foreground">{v.count} order{v.count !== 1 ? "s" : ""}</p>
                <p className="font-medium">{formatCurrency(v.totalAmount)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order Date</TableHead><TableHead>Order#</TableHead><TableHead>Party</TableHead>
                <TableHead>Driver</TableHead><TableHead>Vehicle</TableHead><TableHead>Vehicle No.</TableHead>
                <TableHead>Delivery Date</TableHead><TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                : !orders.length
                  ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No dispatched orders for selected period</TableCell></TableRow>
                  : orders.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{formatDate(o.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{o.partyName}</TableCell>
                      <TableCell className="text-sm">{o.driverName || "-"}</TableCell>
                      <TableCell className="text-sm">{o.vehicleName || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{o.vehicleNo || "-"}</TableCell>
                      <TableCell className="text-sm">{o.deliveryDate ? formatDate(o.deliveryDate) : "-"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(o.grandTotal)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[o.status] || ""}`}>{o.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
