import { Link, useLocation } from "wouter";
import { Home, Receipt, BookOpen, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [location] = useLocation();

  const navItems = [
    {
      label: "Home",
      icon: Home,
      href: "/",
    },
    {
      label: "Sale",
      icon: Receipt,
      href: "/sales/invoices/new",
    },
    {
      label: "All Sales",
      icon: FileText,
      href: "/sales/invoices",
    },
    {
      label: "Ledgers",
      icon: BookOpen,
      href: "/accounts/ledgers",
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/40 pb-safe">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.label} href={item.href}>
              <a
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 px-2 text-muted-foreground hover:text-primary transition-colors",
                  isActive && "text-primary font-medium"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
