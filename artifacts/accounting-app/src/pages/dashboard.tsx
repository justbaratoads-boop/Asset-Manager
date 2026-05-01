import { useGetDashboardSummary, useGetRecentActivity, useGetLowStockAlerts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { TrendingUp, TrendingDown, Package, ShoppingCart, Receipt, AlertTriangle, Calendar } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFY } from "@/lib/financial-year";

function KpiCard({ title, value, icon: Icon, variant = "default" }: { title: string; value: string; icon: any; variant?: string }) {
  return (
    <Card>
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
  const { data: summary, isLoading: loadingSum } = useGetDashboardSummary();
  const { data: activity = [], isLoading: loadingAct } = useGetRecentActivity();
  const { data: lowStock = [], isLoading: loadingStock } = useGetLowStockAlerts();
  const { fy, setFYStart, availableFYs } = useFY();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Today's business snapshot</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Financial Year:</span>
          <Select value={String(fy.startYear)} onValueChange={v => setFYStart(Number(v))}>
            <SelectTrigger className="w-28 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableFYs.map(f => (
                <SelectItem key={f.startYear} value={String(f.startYear)}>FY {f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Today's Sales" value={loadingSum ? "..." : formatCurrency(summary?.todaySales)} icon={TrendingUp} variant="green" />
        <KpiCard title="Today's Collections" value={loadingSum ? "..." : formatCurrency(summary?.todayCollections)} icon={Receipt} variant="green" />
        <KpiCard title="Open Orders" value={loadingSum ? "..." : String(summary?.openOrdersCount || 0)} icon={ShoppingCart} variant="amber" />
        <KpiCard title="Due Payables" value={loadingSum ? "..." : formatCurrency(summary?.duePayables)} icon={TrendingDown} variant="red" />
        <KpiCard title="Low Stock Items" value={loadingSum ? "..." : String(summary?.lowStockCount || 0)} icon={Package} variant="amber" />
        <KpiCard title="Month Sales" value={loadingSum ? "..." : formatCurrency(summary?.monthSales)} icon={TrendingUp} variant="green" />
        <KpiCard title="Month Purchases" value={loadingSum ? "..." : formatCurrency(summary?.monthPurchases)} icon={TrendingDown} />
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
    </div>
  );
}
