import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex w-full bg-muted/40">
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
