import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, TrendingUp, TrendingDown, BarChart2, Receipt, ShoppingCart, DollarSign, Package } from "lucide-react";

const reports = [
  { title: "Day Book", href: "/reports/day-book", desc: "All transactions for a day", icon: BookOpen },
  { title: "Trial Balance", href: "/reports/trial-balance", desc: "All ledger balances", icon: BarChart2 },
  { title: "Profit & Loss", href: "/reports/profit-loss", desc: "Income vs expense summary", icon: TrendingUp },
  { title: "Balance Sheet", href: "/reports/balance-sheet", desc: "Assets, liabilities & capital", icon: DollarSign },
  { title: "Sale Register", href: "/reports/sale-register", desc: "GST-wise sale summary", icon: Receipt },
  { title: "Purchase Register", href: "/reports/purchase-register", desc: "GST-wise purchase summary", icon: ShoppingCart },
  { title: "Cash Book", href: "/reports/cash-book", desc: "Cash receipts & payments", icon: TrendingDown },
  { title: "Current Stock", href: "/inventory/current-stock", desc: "Physical stock with value", icon: Package },
];

export default function ReportsLanding() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Reports</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {reports.map(r => (
          <Link key={r.href} href={r.href}>
            <Card className="cursor-pointer hover:bg-accent transition-colors h-full">
              <CardContent className="p-5">
                <r.icon className="h-6 w-6 text-primary mb-3" />
                <p className="font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
