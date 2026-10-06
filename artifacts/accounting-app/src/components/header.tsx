import { useState } from "react";
import { Search, Bell, Menu, X, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { useFY } from "@/lib/financial-year";
import { Badge } from "./ui/badge";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const { fy, globalFrom, globalTo, setGlobalFrom, setGlobalTo, clearGlobalDates } = useFY();

  const hasFilter = Boolean(globalFrom || globalTo);

  return (
    <header className="h-14 border-b bg-card px-3 sm:px-4 flex items-center justify-between sticky top-0 z-10 w-full max-w-full">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        
        <div className="max-w-md w-full relative hidden sm:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search parties, items, invoices (Alt+K)" 
            className="pl-9 bg-muted/50 border-none focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Mobile Date Filter Button (< sm) */}
        <div className="sm:hidden">
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={hasFilter ? "default" : "outline"}
                size="sm"
                className="h-8 px-2 text-xs gap-1.5"
                title="Date Filter"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>{hasFilter ? "Filtered" : "Filter"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Global Date Filter
                </span>
                {hasFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      clearGlobalDates();
                      setDatePopoverOpen(false);
                    }}
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">From Date</label>
                  <Input 
                    type="date" 
                    value={globalFrom} 
                    onChange={(e) => setGlobalFrom(e.target.value)} 
                    className="h-8 text-xs w-full" 
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">To Date</label>
                  <Input 
                    type="date" 
                    value={globalTo} 
                    onChange={(e) => setGlobalTo(e.target.value)} 
                    className="h-8 text-xs w-full" 
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => setDatePopoverOpen(false)}
              >
                Done
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {/* Desktop Date Filter (>= sm) */}
        <div className="hidden sm:flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
          <Input 
            type="date" 
            value={globalFrom} 
            onChange={(e) => setGlobalFrom(e.target.value)} 
            className="w-32 md:w-36 h-8 text-xs px-2 md:px-3" 
            title="From Date (Saved automatically)"
          />
          <span className="text-muted-foreground text-xs">to</span>
          <Input 
            type="date" 
            value={globalTo} 
            onChange={(e) => setGlobalTo(e.target.value)} 
            className="w-32 md:w-36 h-8 text-xs px-2 md:px-3" 
            title="To Date (Saved automatically)"
          />
          {hasFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearGlobalDates}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground border-dashed"
              title="Clear Saved Date Filter"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <Badge variant="outline" className="hidden lg:flex text-xs font-medium text-muted-foreground border-dashed">
          FY {fy.label}
        </Badge>
        <div className="hidden xl:flex items-center gap-2 mr-2 text-xs font-medium text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-muted rounded border shadow-sm">F2</kbd> Sale
          <kbd className="px-1.5 py-0.5 bg-muted rounded border shadow-sm ml-2">F3</kbd> Receipt
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full"></span>
        </Button>
      </div>
    </header>
  );
}
