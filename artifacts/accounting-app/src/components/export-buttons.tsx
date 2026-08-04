import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { useGetCompanySettings } from "@workspace/api-client-react";
import { useFY } from "@/lib/financial-year";
import { formatDate } from "@/lib/format";

interface Column {
  header: string;
  key: string;
  format?: (v: any) => string;
}

interface ExportButtonsProps {
  data: Record<string, any>[];
  columns: Column[];
  filename?: string;
  title?: string;
}

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function ExportButtons({ data, columns, filename = "report", title }: ExportButtonsProps) {
  const { data: companySettings } = useGetCompanySettings();
  const { globalFrom, globalTo } = useFY();
  
  const businessName = companySettings?.name || "Business Name";
  const dateStr = `From: ${formatDate(globalFrom)} To: ${formatDate(globalTo)}`;

  const handleCSV = () => {
    const titleRow = escapeCSV(businessName);
    const reportTitleRow = escapeCSV(title || filename);
    const dateRow = escapeCSV(dateStr);
    
    const header = columns.map(c => escapeCSV(c.header)).join(",");
    const rows = data.map(row =>
      columns.map(c => {
        const val = row[c.key];
        return escapeCSV(c.format ? c.format(val) : val);
      }).join(",")
    );
    const csv = [titleRow, reportTitleRow, dateRow, "", header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const head = `<thead><tr>${columns.map(c => `<th style="border:1px solid #ccc;padding:6px 10px;background:#f5f5f5;text-align:left">${c.header}</th>`).join("")}</tr></thead>`;
    const body = `<tbody>${data.map(row =>
      `<tr>${columns.map(c => {
        const val = row[c.key];
        return `<td style="border:1px solid #ccc;padding:5px 10px">${c.format ? c.format(val) : (val ?? "")}</td>`;
      }).join("")}</tr>`
    ).join("")}</tbody>`;
    const html = `<!DOCTYPE html><html><head><title>${title || filename}</title><style>body{font-family:sans-serif;font-size:12px;padding:16px}table{border-collapse:collapse;width:100%}h2{margin-bottom:4px;font-size:18px}h3{margin-top:0;margin-bottom:4px;font-size:14px;color:#555}p{margin-top:0;margin-bottom:16px;font-size:12px;color:#777}@media print{button{display:none}}</style></head><body><h2>${businessName}</h2><h3>${title || filename}</h3><p>${dateStr}</p><table>${head}${body}</table></body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleCSV} className="gap-1.5">
        <Download className="h-3.5 w-3.5" />
        Export Excel
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
        <Printer className="h-3.5 w-3.5" />
        Print PDF
      </Button>
    </div>
  );
}
