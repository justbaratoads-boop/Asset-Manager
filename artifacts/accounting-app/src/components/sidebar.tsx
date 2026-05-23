import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, Package, BarChart2, TrendingUp,
  Truck, Percent, Building2, Layers, Wrench, UserCog, Printer,
  Lock, CreditCard, HelpCircle, Settings, LogOut, ChevronDown,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

type NavSubItem = { name: string; href: string; perm?: string };
type NavGroup  = { kind: "group"; name: string; icon: any; items: NavSubItem[]; perm?: string };
type NavLink   = { kind: "link";  name: string; href: string; icon: any; perm?: string };
type NavSep    = { kind: "sep";   label?: string };
type NavItem   = NavGroup | NavLink | NavSep;

const navigation: NavItem[] = [
  // ── Dashboard ──────────────────────────────────────────────
  { kind: "link", name: "Dashboard", href: "/", icon: LayoutDashboard, perm: "dashboard" },

  // ── Vouchers ───────────────────────────────────────────────
  {
    kind: "group", name: "Vouchers", icon: ClipboardList,
    items: [
      { name: "Sale Order",     href: "/sales/orders",           perm: "sales_orders" },
      { name: "Sale",           href: "/sales/invoices",          perm: "sales_invoices" },
      { name: "Purchase Order", href: "/purchase/orders",         perm: "purchase_orders" },
      { name: "Purchase",       href: "/purchase/invoices",       perm: "purchase_invoices" },
      { name: "Payment",        href: "/accounts/payments",       perm: "accounts_payments" },
      { name: "Receipt",        href: "/accounts/receipts",       perm: "accounts_receipts" },
      { name: "Contra",         href: "/accounts/contra",         perm: "accounts_journal" },
      { name: "Journal",        href: "/accounts/journal",        perm: "accounts_journal" },
      { name: "Debit Note",     href: "/accounts/debit-notes",   perm: "accounts_debit_notes" },
      { name: "Credit Note",    href: "/accounts/credit-notes",  perm: "accounts_credit_notes" },
    ],
  },

  // ── Accounts ───────────────────────────────────────────────
  {
    kind: "group", name: "Accounts", icon: BookOpen,
    items: [
      { name: "Chart of Accounts", href: "/accounts/chart-of-accounts", perm: "accounts_parties" },
      { name: "Ledger",            href: "/accounts/ledgers",            perm: "accounts_parties" },
    ],
  },

  // ── Stock ──────────────────────────────────────────────────
  {
    kind: "group", name: "Stock", icon: Package,
    items: [
      { name: "Stock Summary",            href: "/reports/stock-summary",      perm: "reports" },
      { name: "Current Stock Report",     href: "/reports/stock-availability",  perm: "reports" },
      { name: "Stock Report Batch Wise",  href: "/reports/stock-batch",         perm: "reports" },
      { name: "Stock Report Item Wise",   href: "/reports/stock-item-wise",     perm: "reports" },
      { name: "Stock Category",           href: "/inventory/categories",        perm: "inventory_categories" },
      { name: "Stock Items",              href: "/inventory/items",             perm: "inventory_items" },
      { name: "Stock Items Batch",        href: "/inventory/batches",           perm: "inventory_batches" },
    ],
  },

  // ── Report ─────────────────────────────────────────────────
  {
    kind: "group", name: "Report", icon: BarChart2,
    items: [
      { name: "Ledger Report",     href: "/reports/party-statement",    perm: "reports" },
      { name: "Day Book",          href: "/reports/day-book",           perm: "reports" },
      { name: "Cash Book",         href: "/reports/cash-book",          perm: "reports" },
      { name: "Bank Book",         href: "/reports/bank-book",          perm: "reports" },
      { name: "Sale Register",     href: "/reports/sale-register",      perm: "reports" },
      { name: "Purchase Register", href: "/reports/purchase-register",  perm: "reports" },
      { name: "All Transactions",  href: "/reports/all-transactions",   perm: "reports" },
    ],
  },

  // ── Financial Report ───────────────────────────────────────
  {
    kind: "group", name: "Financial Report", icon: TrendingUp,
    items: [
      { name: "Trial Balance",  href: "/reports/trial-balance", perm: "reports" },
      { name: "Profit & Loss",  href: "/reports/profit-loss",   perm: "reports" },
      { name: "Balance Sheet",  href: "/reports/balance-sheet", perm: "reports" },
    ],
  },

  // ── Delivery & Logistics ───────────────────────────────────
  {
    kind: "group", name: "Delivery & Logistics", icon: Truck,
    items: [
      { name: "Delivery Assign",  href: "/delivery",                perm: "delivery" },
      { name: "Delivery Report",  href: "/reports/delivery-report", perm: "delivery" },
      { name: "Driver & Vehicle", href: "/delivery/drivers",        perm: "delivery" },
    ],
  },

  // ── GST Report ─────────────────────────────────────────────
  {
    kind: "group", name: "GST Report", icon: Percent,
    items: [
      { name: "GSTR-3B",    href: "/gst/gstr3b",      perm: "gst_reports" },
      { name: "GSTR-2B",    href: "/gst/gstr2b",      perm: "gst_reports" },
      { name: "GSTR-1",     href: "/gst/gstr1",       perm: "gst_reports" },
      { name: "HSN Report", href: "/gst/hsn-summary", perm: "gst_reports" },
    ],
  },

  // ── Business Profile ───────────────────────────────────────
  { kind: "link", name: "Business Profile", href: "/settings", icon: Building2, perm: "settings_company" },

  // ── Manage Company ─────────────────────────────────────────
  {
    kind: "group", name: "Manage Company", icon: Layers,
    items: [
      { name: "Add Company",    href: "/company/add",    perm: "settings_company" },
      { name: "Switch Company", href: "/company/switch", perm: "settings_company" },
    ],
  },

  // ── separator ──────────────────────────────────────────────
  { kind: "sep", label: "Settings" },

  // ── Utility ────────────────────────────────────────────────
  {
    kind: "group", name: "Utility", icon: Wrench,
    items: [
      { name: "Export Data (Excel)", href: "/utility/export",   perm: "settings_company" },
      { name: "Import Data (Excel)", href: "/utility/import",   perm: "settings_company" },
      { name: "Backup",              href: "/utility/backup",   perm: "settings_company" },
      { name: "Recycle Bin",         href: "/settings/recycle-bin", perm: "settings_company" },
    ],
  },

  // ── User Role ──────────────────────────────────────────────
  {
    kind: "group", name: "User Role", icon: UserCog,
    items: [
      { name: "Users & Roles", href: "/settings/users", perm: "settings_users" },
    ],
  },

  // ── Invoice Print Setting ──────────────────────────────────
  { kind: "link", name: "Invoice Print Setting", href: "/settings/print", icon: Printer, perm: "settings_print" },

  // ── Password / Fingerprint ─────────────────────────────────
  { kind: "link", name: "Password / Fingerprint", href: "/settings/security", icon: Lock, perm: "settings_company" },

  // ── Plan & Pricing ─────────────────────────────────────────
  { kind: "link", name: "Plan & Pricing", href: "/plan-pricing", icon: CreditCard },

  // ── Help & Support ─────────────────────────────────────────
  { kind: "link", name: "Help & Support", href: "/help-support", icon: HelpCircle },
];

const ROLE_DEFAULT_PERMS: Record<string, string[]> = {
  admin: [
    "dashboard","sales_invoices","sales_orders","purchase_invoices","purchase_orders",
    "accounts_parties","accounts_journal","accounts_payments","accounts_receipts",
    "accounts_credit_notes","accounts_debit_notes","inventory_items","inventory_categories",
    "inventory_stock","inventory_batches","reports","gst_reports","delivery",
    "settings_company","settings_print","settings_users",
  ],
  accountant: [
    "dashboard","sales_invoices","sales_orders","purchase_invoices","purchase_orders",
    "accounts_parties","accounts_journal","accounts_payments","accounts_receipts",
    "accounts_credit_notes","accounts_debit_notes","inventory_items","inventory_categories",
    "inventory_stock","inventory_batches","reports","gst_reports","settings_company","settings_print",
  ],
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

function SidebarLink({ item, onNavigate }: { item: NavLink; onNavigate?: () => void }) {
  const [location] = useLocation();
  const isActive = item.href === "/" ? location === "/" : location === item.href || location.startsWith(item.href + "/");
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

function SidebarGroup({ item, user, onNavigate }: { item: NavGroup; user: any; onNavigate?: () => void }) {
  const [location] = useLocation();
  const visibleItems = item.items.filter((sub) => canView(user, sub.perm));
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
            (subItem.href !== "/" && location.startsWith(subItem.href + "/"));
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

function SidebarSep({ label }: { label?: string }) {
  return (
    <div className="pt-3 pb-1 px-3 flex items-center gap-2">
      {label && <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">{label}</span>}
      <div className="flex-1 h-px bg-sidebar-border" />
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
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
          {navigation.map((item, idx) => {
            if (item.kind === "sep") {
              return <SidebarSep key={idx} label={item.label} />;
            }
            if (item.kind === "group") {
              return <SidebarGroup key={item.name} item={item} user={user} onNavigate={onNavigate} />;
            }
            if (!canView(user, item.perm)) return null;
            return <SidebarLink key={item.name} item={item} onNavigate={onNavigate} />;
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
