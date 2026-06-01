import { useState } from "react";
import { useGetDeliveryReport } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useFY } from "@/lib/financial-year";
import { Truck } from "lucide-react";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  dispatched: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const ALL_COLUMNS = [
  { header: "Order Date", key: "date", format: formatDate },
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
  const { fy, globalFrom: from, globalTo: to } = useFY();
  
  
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetDeliveryReport({ from: from || undefined, to: to || undefined });
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("delivery-report", ALL_COLUMNS);
  const vis = visibleKeys;

  const orders: any[] = (data as any)?.orders || [];
  const vehicleSummary: any[] = (data as any)?.vehicleSummary || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Delivery Report</h1>
        <div className="flex items-center gap-2">
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          <ExportButtons data={orders} columns={visibleColumns} filename={`delivery-report-${from}-${to}`} title="Delivery Report" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        
        
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
                {vis.has("date") && <TableHead>Order Date</TableHead>}
                {vis.has("orderNumber") && <TableHead>Order#</TableHead>}
                {vis.has("partyName") && <TableHead>Party</TableHead>}
                {vis.has("driverName") && <TableHead>Driver</TableHead>}
                {vis.has("vehicleName") && <TableHead>Vehicle</TableHead>}
                {vis.has("vehicleNo") && <TableHead>Vehicle No.</TableHead>}
                {vis.has("deliveryDate") && <TableHead>Delivery Date</TableHead>}
                {vis.has("grandTotal") && <TableHead className="text-right">Amount</TableHead>}
                {vis.has("status") && <TableHead>Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                : !orders.length
                  ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">No dispatched orders for selected period</TableCell></TableRow>
                  : orders.map((o: any) => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/sales/orders/${o.id}`)}>
                      {vis.has("date") && <TableCell className="text-sm">{formatDate(o.date)}</TableCell>}
                      {vis.has("orderNumber") && <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>}
                      {vis.has("partyName") && <TableCell className="max-w-[140px] truncate">{o.partyName}</TableCell>}
                      {vis.has("driverName") && <TableCell className="text-sm">{o.driverName || "-"}</TableCell>}
                      {vis.has("vehicleName") && <TableCell className="text-sm">{o.vehicleName || "-"}</TableCell>}
                      {vis.has("vehicleNo") && <TableCell className="font-mono text-xs">{o.vehicleNo || "-"}</TableCell>}
                      {vis.has("deliveryDate") && <TableCell className="text-sm">{o.deliveryDate ? formatDate(o.deliveryDate) : "-"}</TableCell>}
                      {vis.has("grandTotal") && <TableCell className="text-right font-medium">{formatCurrency(o.grandTotal)}</TableCell>}
                      {vis.has("status") && <TableCell><Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[o.status] || ""}`}>{o.status}</Badge></TableCell>}
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

