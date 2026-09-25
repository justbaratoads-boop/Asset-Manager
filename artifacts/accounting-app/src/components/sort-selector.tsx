import { ArrowDownAZ, ArrowUpZA, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SortDirection, SortColumnOption } from "@/hooks/use-report-sort";

interface SortSelectorProps {
  columns: SortColumnOption[];
  sortKey: string;
  sortDir: SortDirection;
  onSortChange: (key: string, dir: SortDirection) => void;
  onReset?: () => void;
}

export function SortSelector({
  columns,
  sortKey,
  sortDir,
  onSortChange,
  onReset,
}: SortSelectorProps) {
  const currentCol = columns.find(c => c.key === sortKey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sort</span>
          {currentCol && (
            <span className="text-xs text-primary font-medium ml-0.5 max-w-24 truncate">
              : {currentCol.header} {sortDir === "asc" ? "↑" : "↓"}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs uppercase text-muted-foreground font-semibold">
          Sort by Column
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map(col => {
          const isActive = sortKey === col.key;
          return (
            <DropdownMenuItem
              key={col.key}
              className="flex items-center justify-between text-xs cursor-pointer py-1.5"
              onClick={() => {
                if (isActive) {
                  onSortChange(col.key, sortDir === "asc" ? "desc" : "asc");
                } else {
                  onSortChange(col.key, "asc");
                }
              }}
            >
              <span className={isActive ? "font-semibold text-primary" : ""}>
                {col.header}
              </span>
              {isActive ? (
                sortDir === "asc" ? (
                  <ArrowDownAZ className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <ArrowUpZA className="h-3.5 w-3.5 text-primary" />
                )
              ) : null}
            </DropdownMenuItem>
          );
        })}
        {sortKey && onReset && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-muted-foreground cursor-pointer justify-center"
              onClick={onReset}
            >
              Clear Sort
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
