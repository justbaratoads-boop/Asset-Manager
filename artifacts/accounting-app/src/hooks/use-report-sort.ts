import { useState, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortColumnOption {
  key: string;
  header: string;
}

export function useReportSort<T extends Record<string, any>>(
  data: T[],
  defaultKey: string = "",
  defaultDir: SortDirection = null
) {
  const [sortKey, setSortKey] = useState<string>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultDir);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir(null);
      setSortKey("");
    } else {
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir || !Array.isArray(data)) return data;

    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === "") return 1;
      if (valB === null || valB === undefined || valB === "") return -1;

      // Handle numbers / numeric strings
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && typeof valA !== "boolean") {
        return sortDir === "asc" ? numA - numB : numB - numA;
      }

      // Handle dates (ISO strings or YYYY-MM-DD)
      const dateA = Date.parse(String(valA));
      const dateB = Date.parse(String(valB));
      if (!isNaN(dateA) && !isNaN(dateB) && String(valA).length >= 8 && isNaN(Number(valA))) {
        return sortDir === "asc" ? dateA - dateB : dateB - dateA;
      }

      // Default string comparison
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortDir]);

  return {
    sortedData,
    sortKey,
    sortDir,
    setSortKey,
    setSortDir,
    toggleSort,
  };
}
