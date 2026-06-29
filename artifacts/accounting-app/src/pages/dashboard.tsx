import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetRecentActivity, useGetLowStockAlerts, customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, Package, ShoppingCart, Receipt, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function KpiCard({ title, value, icon: Icon, variant = "default", onClick }: { title: string; value: string; icon: any; variant?: string; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={onClick ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground leading-tight">{title}</p>
            <p className="text-xl font-bold mt-1 break-words leading-tight">{value}</p>
          </div>
          <div className={`p-2 rounded-md shrink-0 ${variant === "green" ? "bg-green-100 text-green-600" : variant === "red" ? "bg-red-100 text-red-600" : variant === "amber" ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [periodFrom, setPeriodFrom] = useState(monthStart);
  const [periodTo, setPeriodTo] = useState(todayStr);

  const { data: summary, isLoading: loadingSum } = useQuery({
    queryKey: ["dashboard-summary", periodFrom, periodTo],
    queryFn: () => customFetch<any>(`/api/dashboard/summary?from=${periodFrom}&to=${periodTo}`),
    staleTime: 60_000,
  });

  const [selectedKpi, setSelectedKpi] = useState<{ type: string; title: string } | null>(null);

  const { data: kpiDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["dashboard-details", selectedKpi?.type, periodFrom, periodTo],
    queryFn: () => customFetch<any[]>(`/api/dashboard/details?type=${selectedKpi?.type}&from=${periodFrom}&to=${periodTo}`),
    enabled: !!selectedKpi,
  });

  const { data: activity = [], isLoading: loadingAct } = useGetRecentActivity();
  const { data: lowStock = [], isLoading: loadingStock } = useGetLowStockAlerts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Today's business snapshot</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
            <Input
              type="date"
              value={periodFrom}
              onChange={e => setPeriodFrom(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
            <Input
              type="date"
              value={periodTo}
              onChange={e => setPeriodTo(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Today's Sales" value={loadingSum ? "..." : formatCurrency(summary?.todaySales)} icon={TrendingUp} variant="green" onClick={() => setSelectedKpi({ type: "todaySales", title: "Today's Sales" })} />
        <KpiCard title="Today's Collections" value={loadingSum ? "..." : formatCurrency(summary?.todayCollections)} icon={Receipt} variant="green" onClick={() => setSelectedKpi({ type: "todayCollections", title: "Today's Collections" })} />
        <KpiCard title="Open Orders" value={loadingSum ? "..." : String(summary?.openOrdersCount || 0)} icon={ShoppingCart} variant="amber" onClick={() => setSelectedKpi({ type: "openOrders", title: "Open Orders" })} />
        <KpiCard title="Due Payables" value={loadingSum ? "..." : formatCurrency(summary?.duePayables)} icon={TrendingDown} variant="red" onClick={() => setSelectedKpi({ type: "duePayables", title: "Due Payables" })} />
        <KpiCard title="Low Stock Items" value={loadingSum ? "..." : String(summary?.lowStockCount || 0)} icon={Package} variant="amber" onClick={() => setSelectedKpi({ type: "lowStock", title: "Low Stock Items" })} />
        <KpiCard title="Period Sales" value={loadingSum ? "..." : formatCurrency(summary?.periodSales)} icon={TrendingUp} variant="green" onClick={() => setSelectedKpi({ type: "periodSales", title: "Period Sales" })} />
        <KpiCard title="Period Purchases" value={loadingSum ? "..." : formatCurrency(summary?.periodPurchases)} icon={TrendingDown} onClick={() => setSelectedKpi({ type: "periodPurchases", title: "Period Purchases" })} />
        <KpiCard title="Period Collections" value={loadingSum ? "..." : formatCurrency(summary?.periodCollections)} icon={Receipt} variant="green" onClick={() => setSelectedKpi({ type: "periodCollections", title: "Period Collections" })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAct ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : activity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {activity.map((item: any, i: number) => (
                  <div key={i} className="flex items-start justify-between py-2 border-b last:border-0 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                    </div>
                    <span className="text-sm font-semibold shrink-0">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Low Stock Alerts</CardTitle>
              <Link href="/inventory/current-stock" className="text-xs text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {loadingStock ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : lowStock.length === 0 ? (
              <p className="text-muted-foreground text-sm text-green-600">All stock levels are healthy</p>
            ) : (
              <div className="space-y-2">
                {lowStock.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Min: {item.minStockLevel} {item.unit}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 shrink-0">
                      {item.physicalStock} {item.unit}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/sales/invoices/new">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-4 text-center">
              <Receipt className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">New Sale Invoice</p>
              <p className="text-xs text-muted-foreground">F2</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/accounts/receipts/new">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <p className="text-sm font-medium">New Receipt</p>
              <p className="text-xs text-muted-foreground">F3</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/accounts/payments/new">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-4 text-center">
              <TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <p className="text-sm font-medium">New Payment</p>
              <p className="text-xs text-muted-foreground">F4</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/sales/orders/new">
          <Card className="cursor-pointer hover:bg-accent transition-colors">
            <CardContent className="p-4 text-center">
              <ShoppingCart className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-sm font-medium">New Order</p>
            </CardContent>
          </Card>
        </Link>
      </div>
      <Dialog open={!!selectedKpi} onOpenChange={(open) => !open && setSelectedKpi(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedKpi?.title}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto mt-4">
            {loadingDetails ? (
              <p className="text-muted-foreground text-sm">Loading details...</p>
            ) : kpiDetails && kpiDetails.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpiDetails.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell>
                        {row.status ? <Badge variant="outline">{row.status}</Badge> : "-"}
                      </TableCell>
                      <TableCell className="text-right">{row.amount > 0 ? formatCurrency(row.amount) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">No entries found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
