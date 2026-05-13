import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ColumnDef } from "@/hooks/use-column-visibility";

interface ColumnSelectorProps {
  allColumns: ColumnDef[];
  visibleKeys: Set<string>;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

export function ColumnSelector({
  allColumns,
  visibleKeys,
  onToggle,
  onSelectAll,
  onClearAll,
}: ColumnSelectorProps) {
  const hiddenCount = allColumns.length - visibleKeys.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="h-3.5 w-3.5" />
          Columns
          {hiddenCount > 0 && (
            <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0 leading-5">
              {hiddenCount} hidden
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
          Toggle Columns
        </p>
        <div className="flex gap-2 mb-2">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex-1" onClick={onSelectAll}>
            All
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs flex-1" onClick={onClearAll}>
            Reset
          </Button>
        </div>
        <Separator className="mb-2" />
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {allColumns.map(col => (
            <div key={col.key} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50 cursor-pointer" onClick={() => onToggle(col.key)}>
              <Checkbox
                id={`col-${col.key}`}
                checked={visibleKeys.has(col.key)}
                onCheckedChange={() => onToggle(col.key)}
                onClick={e => e.stopPropagation()}
              />
              <Label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer select-none flex-1">
                {col.header}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
