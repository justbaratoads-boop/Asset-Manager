import { useState, useCallback } from "react";

export interface ColumnDef {
  header: string;
  key: string;
  format?: (v: any) => string;
}

function loadKeys(storageKey: string, defaultKeys: string[]): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed: string[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return defaultKeys;
}

export function useColumnVisibility<T extends ColumnDef>(reportKey: string, allColumns: T[]) {
  const storageKey = `col-vis:${reportKey}`;
  const allKeys = allColumns.map(c => c.key);

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() =>
    loadKeys(storageKey, allKeys)
  );

  const save = useCallback((keys: string[]) => {
    setVisibleKeys(keys);
    try { localStorage.setItem(storageKey, JSON.stringify(keys)); } catch {}
  }, [storageKey]);

  const toggle = useCallback((key: string) => {
    setVisibleKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      const ordered = allKeys.filter(k => next.includes(k));
      try { localStorage.setItem(storageKey, JSON.stringify(ordered)); } catch {}
      return ordered;
    });
  }, [allKeys, storageKey]);

  const setAll = useCallback((visible: boolean) => {
    save(visible ? allKeys : [allKeys[0]]);
  }, [allKeys, save]);

  const visSet = new Set(visibleKeys);
  const visibleColumns = allColumns.filter(c => visSet.has(c.key));

  return { visibleKeys: visSet, visibleColumns, toggle, setAll, allColumns };
}
