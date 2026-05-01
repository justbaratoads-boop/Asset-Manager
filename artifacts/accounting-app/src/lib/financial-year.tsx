import { createContext, useContext, useState, ReactNode, useMemo } from "react";

function getCurrentFYStart(startMonth: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= startMonth ? year : year - 1;
}

function buildFY(startYear: number, startMonth: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const from = `${startYear}-${pad(startMonth)}-01`;
  const to = `${endYear}-${pad(endMonth)}-${lastDay}`;
  const label = `${startYear}-${String(endYear).slice(2)}`;
  return { from, to, label, startYear, endYear };
}

export type FYInfo = { from: string; to: string; label: string; startYear: number; endYear: number };

type FYContextType = {
  fy: FYInfo;
  setFYStart: (year: number) => void;
  availableFYs: FYInfo[];
  startMonth: number;
};

const FYContext = createContext<FYContextType | undefined>(undefined);

export function FYProvider({ children, startMonth = 4 }: { children: ReactNode; startMonth?: number }) {
  const current = getCurrentFYStart(startMonth);
  const [fyStartYear, setFYStart] = useState(current);

  const fy = useMemo(() => buildFY(fyStartYear, startMonth), [fyStartYear, startMonth]);

  const availableFYs = useMemo(() => {
    const fys: FYInfo[] = [];
    for (let y = current - 3; y <= current + 1; y++) {
      fys.push(buildFY(y, startMonth));
    }
    return fys;
  }, [current, startMonth]);

  return (
    <FYContext.Provider value={{ fy, setFYStart, availableFYs, startMonth }}>
      {children}
    </FYContext.Provider>
  );
}

export function useFY() {
  const ctx = useContext(FYContext);
  if (!ctx) throw new Error("useFY must be used within FYProvider");
  return ctx;
}
