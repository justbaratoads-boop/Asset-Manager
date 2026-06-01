import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export default function GSTR1() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading } = useQuery({
    queryKey: ["gstr1", { month, year }],
    queryFn: () => customFetch(`/api/gst/gstr1?month=${month}&year=${year}`)
  });

  const invoices = (data as any)?.invoices || [];
  const summary = (data as any)?.summary || { b2b: 0, b2cLarge: 0, b2cSmall: 0, totalTaxable: 0, totalGst: 0 };

  const columns = [
    { header: "Type", key: "type" },
    { header: "Date", key: "date" },
    { header: "Invoice No", key: "invoiceNumber" },
    { header: "Customer Name", key: "customerName" },
    { header: "GSTIN", key: "gstin" },
    { header: "Taxable Value", key: "taxableAmount" },
    { header: "CGST", key: "cgst" },
    { header: "SGST", key: "sgst" },
    { header: "IGST", key: "igst" },
    { header: "Total Value", key: "total" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">GSTR-1 (Outward Supplies)</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(0, i).toLocaleString('default', { month: 'short' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ExportButtons data={invoices} columns={columns} filename={`gstr1-${month}-${year}`} title="GSTR-1 Report" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">B2B Sales</p>
            <p className="font-bold text-lg">{formatCurrency(summary.b2b)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">B2C Large</p>
            <p className="font-bold text-lg">{formatCurrency(summary.b2cLarge)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">B2C Small</p>
            <p className="font-bold text-lg">{formatCurrency(summary.b2cSmall)}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Taxable</p>
            <p className="font-bold text-lg text-primary">{formatCurrency(summary.totalTaxable)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Invoice No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No sales for this period</TableCell></TableRow>
              ) : (
                invoices.map((inv: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant={inv.type === 'B2B' ? 'default' : 'secondary'} className="text-[10px]">
                        {inv.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{inv.customerName}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.gstin || "-"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(inv.taxableAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{inv.cgst ? formatCurrency(inv.cgst) : "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{inv.sgst ? formatCurrency(inv.sgst) : "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{inv.igst ? formatCurrency(inv.igst) : "-"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
