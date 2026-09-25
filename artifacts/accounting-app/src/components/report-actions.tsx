import { ColumnSelector } from "@/components/column-selector";
import { ExportButtons } from "@/components/export-buttons";
import { SortSelector } from "@/components/sort-selector";
import { ShareButton } from "@/components/share-button";
import type { ColumnDef } from "@/hooks/use-column-visibility";
import type { SortDirection, SortColumnOption } from "@/hooks/use-report-sort";

interface ReportActionsProps {
  // Sort
  allColumns: ColumnDef[];
  sortKey?: string;
  sortDir?: SortDirection;
  onSortChange?: (key: string, dir: SortDirection) => void;
  onResetSort?: () => void;

  // Columns
  visibleKeys: Set<string>;
  onToggleColumn: (key: string) => void;
  onSelectAllColumns: () => void;
  onClearAllColumns: () => void;

  // Export & Print
  data: Record<string, any>[];
  visibleColumns: ColumnDef[];
  filename: string;
  title: string;

  // Share
  shareSummary?: string;
}

export function ReportActions({
  allColumns,
  sortKey = "",
  sortDir = null,
  onSortChange,
  onResetSort,
  visibleKeys,
  onToggleColumn,
  onSelectAllColumns,
  onClearAllColumns,
  data,
  visibleColumns,
  filename,
  title,
  shareSummary,
}: ReportActionsProps) {
  const sortOptions: SortColumnOption[] = allColumns.map(c => ({
    key: c.key,
    header: c.header,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSortChange && (
        <SortSelector
          columns={sortOptions}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={onSortChange}
          onReset={onResetSort}
        />
      )}
      <ColumnSelector
        allColumns={allColumns}
        visibleKeys={visibleKeys}
        onToggle={onToggleColumn}
        onSelectAll={onSelectAllColumns}
        onClearAll={onClearAllColumns}
      />
      <ExportButtons
        data={data}
        columns={visibleColumns}
        filename={filename}
        title={title}
      />
      <ShareButton
        title={title}
        summaryText={shareSummary}
      />
    </div>
  );
}
