import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Receipt, ShoppingCart, Users, BookOpen, Package,
  FileText, Percent, Truck, Settings, LogOut, ChevronDown, Printer
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    name: "Sales",
    icon: Receipt,
    items: [
      { name: "Sale Invoices", href: "/sales/invoices" },
      { name: "Order Booking", href: "/sales/orders" },
    ],
  },
  {
    name: "Purchase",
    icon: ShoppingCart,
    items: [
      { name: "Purchase Invoices", href: "/purchase/invoices" },
      { name: "Purchase Orders", href: "/purchase/orders" },
    ],
  },
  {
    name: "Accounts",
    icon: BookOpen,
    items: [
      { name: "Journal Entries", href: "/accounts/journal" },
      { name: "Payments", href: "/accounts/payments" },
      { name: "Receipts", href: "/accounts/receipts" },
      { name: "Parties", href: "/accounts/parties" },
      { name: "Credit Notes", href: "/accounts/credit-notes" },
      { name: "Debit Notes", href: "/accounts/debit-notes" },
    ],
  },
  {
    name: "Inventory",
    icon: Package,
    items: [
      { name: "Stock Items", href: "/inventory/items" },
      { name: "Categories", href: "/inventory/categories" },
      { name: "Current Stock", href: "/inventory/current-stock" },
      { name: "Batches", href: "/inventory/batches" },
    ],
  },
  {
    name: "Reports",
    icon: FileText,
    items: [
      { name: "All Reports", href: "/reports" },
      { name: "Day Book", href: "/reports/day-book" },
      { name: "Trial Balance", href: "/reports/trial-balance" },
      { name: "Profit & Loss", href: "/reports/profit-loss" },
      { name: "Balance Sheet", href: "/reports/balance-sheet" },
      { name: "Sale Register", href: "/reports/sale-register" },
      { name: "Purchase Register", href: "/reports/purchase-register" },
      { name: "Cash Book", href: "/reports/cash-book" },
      { name: "All Transactions", href: "/reports/all-transactions" },
      { name: "Party Statement", href: "/reports/party-statement" },
      { name: "Stock Summary", href: "/reports/stock-summary" },
      { name: "Delivery Report", href: "/reports/delivery-report" },
    ],
  },
  {
    name: "GST Reports",
    icon: Percent,
    items: [
      { name: "GSTR-3B", href: "/gst/gstr3b" },
      { name: "GSTR-2B", href: "/gst/gstr2b" },
      { name: "HSN Summary", href: "/gst/hsn-summary" },
    ],
  },
  { name: "Delivery", icon: Truck, href: "/delivery" },
  {
    name: "Settings",
    icon: Settings,
    items: [
      { name: "Company Settings", href: "/settings" },
      { name: "Print Settings", href: "/settings/print" },
      { name: "Users & Roles", href: "/settings/users" },
      { name: "Vehicles", href: "/settings/vehicles" },
    ],
  },
];

function NavItem({ item, isActive, onNavigate }: { item: any; isActive: boolean; onNavigate?: () => void }) {
  if (item.items) return <NavGroup item={item} onNavigate={onNavigate} />;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.name}
    </Link>
  );
}

function NavGroup({ item, onNavigate }: { item: any; onNavigate?: () => void }) {
  const [location] = useLocation();
  const isActiveGroup = item.items.some((sub: any) => location === sub.href || location.startsWith(sub.href + "/"));
  const [isOpen, setIsOpen] = useState(isActiveGroup);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-1">
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors",
            isActiveGroup
              ? "text-sidebar-foreground font-semibold"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <div className="flex items-center gap-3">
            <item.icon className="h-4 w-4 shrink-0" />
            {item.name}
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform shrink-0", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 px-3">
        {item.items.map((subItem: any) => {
          const isActive = location === subItem.href || (location.startsWith(subItem.href + "/") && subItem.href !== "/");
          return (
            <Link
              key={subItem.name}
              href={subItem.href}
              onClick={onNavigate}
              className={cn(
                "block px-8 py-1.5 text-sm rounded-md transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {subItem.name}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const [location] = useLocation();
  const { logout, user } = useAuth();

  return (
    <div className="flex w-64 flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2 font-bold text-sidebar-foreground text-lg tracking-tight">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground text-xs font-bold">
            Acc
          </div>
          Accounting
        </div>
      </div>

      <ScrollArea className="flex-1 py-4 px-3">
        <div className="space-y-1">
          {navigation.map((item) => (
            <NavItem
              key={item.name}
              item={item}
              isActive={item.href ? location === item.href : false}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border space-y-4 bg-sidebar">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-medium uppercase shrink-0">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{user?.role?.replace("_", " ")}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
}
