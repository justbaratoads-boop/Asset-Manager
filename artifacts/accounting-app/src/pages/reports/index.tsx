import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, TrendingUp, TrendingDown, BarChart2, Receipt, ShoppingCart,
  DollarSign, Package, Layers, Users, BarChart, Truck
} from "lucide-react";

const reports = [
  { title: "Day Book", href: "/reports/day-book", desc: "All transactions for a day", icon: BookOpen, color: "text-blue-600" },
  { title: "Trial Balance", href: "/reports/trial-balance", desc: "All ledger balances", icon: BarChart2, color: "text-indigo-600" },
  { title: "Profit & Loss", href: "/reports/profit-loss", desc: "Income vs expense summary", icon: TrendingUp, color: "text-green-600" },
  { title: "Balance Sheet", href: "/reports/balance-sheet", desc: "Assets, liabilities & capital", icon: DollarSign, color: "text-purple-600" },
  { title: "Sale Register", href: "/reports/sale-register", desc: "GST-wise sale summary", icon: Receipt, color: "text-emerald-600" },
  { title: "Purchase Register", href: "/reports/purchase-register", desc: "GST-wise purchase summary", icon: ShoppingCart, color: "text-cyan-600" },
  { title: "Cash Book", href: "/reports/cash-book", desc: "Cash receipts & payments", icon: TrendingDown, color: "text-amber-600" },
  { title: "Current Stock", href: "/inventory/current-stock", desc: "Physical stock with value", icon: Package, color: "text-orange-600" },
  { title: "All Transactions", href: "/reports/all-transactions", desc: "Complete transaction history", icon: Layers, color: "text-slate-600" },
  { title: "Party Statement", href: "/reports/party-statement", desc: "Party-wise account ledger", icon: Users, color: "text-pink-600" },
  { title: "Stock Summary", href: "/reports/stock-summary", desc: "Item-wise opening, purchase, sale & closing", icon: BarChart, color: "text-rose-600" },
  { title: "Delivery Report", href: "/reports/delivery-report", desc: "Orders dispatched by vehicle & driver", icon: Truck, color: "text-teal-600" },
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
                <r.icon className={`h-6 w-6 mb-3 ${r.color}`} />
                <p className="font-semibold text-sm">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{r.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
