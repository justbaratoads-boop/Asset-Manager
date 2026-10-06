import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex w-full max-w-full overflow-x-hidden bg-muted/40 pb-16 md:pb-0">
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0 max-w-full overflow-x-hidden">
        <Header />
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden max-w-full">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
