import { Search, Bell, Menu } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  return (
    <header className="h-14 border-b bg-card px-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar />
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

      <div className="flex items-center gap-2">
        <div className="hidden lg:flex items-center gap-2 mr-4 text-xs font-medium text-muted-foreground">
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
