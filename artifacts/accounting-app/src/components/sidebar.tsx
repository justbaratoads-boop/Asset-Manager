import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Receipt, ShoppingCart, BookOpen, Package,
  FileText, Percent, Truck, Settings, LogOut, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

type NavSubItem = { name: string; href: string; perm?: string };
type NavItem = { name: string; href?: string; icon: any; items?: NavSubItem[]; perm?: string };

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, perm: "dashboard" },
  {
    name: "Sales", icon: Receipt,
    items: [
      { name: "Sale Invoices", href: "/sales/invoices", perm: "sales_invoices" },
      { name: "Order Booking", href: "/sales/orders", perm: "sales_orders" },
    ],
  },
  {
    name: "Purchase", icon: ShoppingCart,
    items: [
      { name: "Purchase Invoices", href: "/purchase/invoices", perm: "purchase_invoices" },
      { name: "Purchase Orders", href: "/purchase/orders", perm: "purchase_orders" },
    ],
  },
  {
    name: "Accounts", icon: BookOpen,
    items: [
      { name: "Chart of Accounts", href: "/accounts/chart-of-accounts", perm: "accounts_parties" },
      { name: "Journal Entries", href: "/accounts/journal", perm: "accounts_journal" },
      { name: "Payments", href: "/accounts/payments", perm: "accounts_payments" },
      { name: "Receipts", href: "/accounts/receipts", perm: "accounts_receipts" },
      { name: "Ledger Accounts", href: "/accounts/ledgers", perm: "accounts_parties" },
      { name: "Credit Notes", href: "/accounts/credit-notes", perm: "accounts_credit_notes" },
      { name: "Debit Notes", href: "/accounts/debit-notes", perm: "accounts_debit_notes" },
    ],
  },
  {
    name: "Inventory", icon: Package,
    items: [
      { name: "Stock Items", href: "/inventory/items", perm: "inventory_items" },
      { name: "Categories", href: "/inventory/categories", perm: "inventory_categories" },
      { name: "Current Stock", href: "/inventory/current-stock", perm: "inventory_stock" },
      { name: "Batches", href: "/inventory/batches", perm: "inventory_batches" },
    ],
  },
  {
    name: "Reports", icon: FileText,
    items: [
      { name: "All Reports", href: "/reports", perm: "reports" },
      { name: "Day Book", href: "/reports/day-book", perm: "reports" },
      { name: "Trial Balance", href: "/reports/trial-balance", perm: "reports" },
      { name: "Profit & Loss", href: "/reports/profit-loss", perm: "reports" },
      { name: "Balance Sheet", href: "/reports/balance-sheet", perm: "reports" },
      { name: "Sale Register", href: "/reports/sale-register", perm: "reports" },
      { name: "Purchase Register", href: "/reports/purchase-register", perm: "reports" },
      { name: "Cash Book", href: "/reports/cash-book", perm: "reports" },
      { name: "All Transactions", href: "/reports/all-transactions", perm: "reports" },
      { name: "Party Statement", href: "/reports/party-statement", perm: "reports" },
      { name: "Stock Summary", href: "/reports/stock-summary", perm: "reports" },
      { name: "Stock Availability", href: "/reports/stock-availability", perm: "reports" },
      { name: "Delivery Report", href: "/reports/delivery-report", perm: "reports" },
    ],
  },
  {
    name: "GST Reports", icon: Percent,
    items: [
      { name: "GSTR-3B", href: "/gst/gstr3b", perm: "gst_reports" },
      { name: "GSTR-2B", href: "/gst/gstr2b", perm: "gst_reports" },
      { name: "HSN Summary", href: "/gst/hsn-summary", perm: "gst_reports" },
    ],
  },
  { name: "Delivery", icon: Truck, href: "/delivery", perm: "delivery" },
  {
    name: "Settings", icon: Settings,
    items: [
      { name: "Company Settings", href: "/settings", perm: "settings_company" },
      { name: "Print Settings", href: "/settings/print", perm: "settings_print" },
      { name: "Users & Roles", href: "/settings/users", perm: "settings_users" },
      { name: "Recycle Bin", href: "/settings/recycle-bin", perm: "settings_company" },
    ],
  },
];

const ROLE_DEFAULT_PERMS: Record<string, string[]> = {
  admin: ["dashboard","sales_invoices","sales_orders","purchase_invoices","purchase_orders","accounts_parties","accounts_journal","accounts_payments","accounts_receipts","accounts_credit_notes","accounts_debit_notes","inventory_items","inventory_categories","inventory_stock","inventory_batches","reports","gst_reports","delivery","settings_company","settings_print","settings_users"],
  accountant: ["dashboard","sales_invoices","sales_orders","purchase_invoices","purchase_orders","accounts_parties","accounts_journal","accounts_payments","accounts_receipts","accounts_credit_notes","accounts_debit_notes","inventory_items","inventory_categories","inventory_stock","inventory_batches","reports","gst_reports","settings_company","settings_print"],
  sales_staff: ["dashboard","sales_invoices","sales_orders","accounts_parties","inventory_items","inventory_stock"],
  view_only: ["dashboard","reports","gst_reports"],
};

function getUserPerms(user: any): string[] | null {
  if (!user) return null;
  if (user.role === "admin") return null;
  try {
    const parsed = user.permissions ? JSON.parse(user.permissions) : null;
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed).filter((k) => parsed[k] === true);
    }
  } catch {}
  return ROLE_DEFAULT_PERMS[user.role] ?? [];
}

function canView(user: any, perm: string | undefined): boolean {
  if (!perm) return true;
  const perms = getUserPerms(user);
  if (perms === null) return true;
  return perms.includes(perm);
}

function NavLink({ item, isActive, onNavigate }: { item: NavItem; isActive: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href!}
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

function NavGroup({ item, user, onNavigate }: { item: NavItem; user: any; onNavigate?: () => void }) {
  const [location] = useLocation();
  const visibleItems = (item.items || []).filter((sub) => canView(user, sub.perm));
  const isActiveGroup = visibleItems.some(
    (sub) => location === sub.href || location.startsWith(sub.href + "/")
  );
  const [isOpen, setIsOpen] = useState(isActiveGroup);

  if (visibleItems.length === 0) return null;

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
        {visibleItems.map((subItem) => {
          const isActive =
            location === subItem.href ||
            (location.startsWith(subItem.href + "/") && subItem.href !== "/");
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
          {navigation.map((item) => {
            if (item.items) {
              return <NavGroup key={item.name} item={item} user={user} onNavigate={onNavigate} />;
            }
            if (!canView(user, item.perm)) return null;
            return (
              <NavLink
                key={item.name}
                item={item}
                isActive={item.href ? location === item.href : false}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border space-y-4 bg-sidebar">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-medium uppercase shrink-0">
            {(user as any)?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{(user as any)?.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{(user as any)?.role?.replace("_", " ")}</p>
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
