import { useState } from "react";
import { useGetSaleRegister, useGetPurchaseRegister } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { useFY } from "@/lib/financial-year";

function DateFilters({ from, to, setFrom, setTo }: any) {
  return (
    <div className="flex gap-3">
      <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
      <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
    </div>
  );
}

const saleColumns = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Invoice#", key: "invoiceNumber" },
  { header: "Party", key: "partyName" },
  { header: "GSTIN", key: "partyGstin" },
  { header: "Taxable", key: "totalTaxable", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "CGST", key: "totalCgst", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "SGST", key: "totalSgst", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "IGST", key: "totalIgst", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Grand Total", key: "grandTotal", format: (v: any) => String(Number(v).toFixed(2)) },
];

const purchaseColumns = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Invoice#", key: "invoiceNumber" },
  { header: "Supplier Inv#", key: "supplierInvoiceNumber" },
  { header: "Supplier", key: "partyName" },
  { header: "Taxable", key: "totalTaxable", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "CGST", key: "totalCgst", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "SGST", key: "totalSgst", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "IGST", key: "totalIgst", format: (v: any) => String(Number(v).toFixed(2)) },
  { header: "Grand Total", key: "grandTotal", format: (v: any) => String(Number(v).toFixed(2)) },
];

function SaleRegister() {
  const { fy } = useFY();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const { data, isLoading } = useGetSaleRegister({ from: from || undefined, to: to || undefined });
  const invoices: any[] = (data as any)?.invoices || [];
  const totals = (data as any)?.totals || {};

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <ExportButtons data={invoices} columns={saleColumns} filename={`sale-register-${from}-${to}`} title="Sale Register" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead><TableHead>Invoice#</TableHead><TableHead>Party</TableHead><TableHead>GSTIN</TableHead>
            <TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            : !invoices.length
              ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No data for selected period</TableCell></TableRow>
              : invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.partyName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inv.partyGstin || "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalTaxable)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalCgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalSgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalIgst)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>
                </TableRow>
              ))
          }
          {invoices.length > 0 && (
            <TableRow className="font-bold bg-muted/30">
              <TableCell colSpan={4}>Total ({invoices.length} invoices)</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.taxable)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.cgst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.sgst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.igst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.grandTotal)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

function PurchaseRegister() {
  const { fy } = useFY();
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(fy.to);
  const { data, isLoading } = useGetPurchaseRegister({ from: from || undefined, to: to || undefined });
  const invoices: any[] = (data as any)?.invoices || [];
  const totals = (data as any)?.totals || {};

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <ExportButtons data={invoices} columns={purchaseColumns} filename={`purchase-register-${from}-${to}`} title="Purchase Register" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead><TableHead>Invoice#</TableHead><TableHead>Supplier Inv#</TableHead><TableHead>Supplier</TableHead>
            <TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            : !invoices.length
              ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No data for selected period</TableCell></TableRow>
              : invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.supplierInvoiceNumber || "-"}</TableCell>
                  <TableCell>{inv.partyName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalTaxable)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalCgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalSgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalIgst)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>
                </TableRow>
              ))
          }
          {invoices.length > 0 && (
            <TableRow className="font-bold bg-muted/30">
              <TableCell colSpan={4}>Total ({invoices.length} invoices)</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.taxable)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.cgst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.sgst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.igst)}</TableCell>
              <TableCell className="text-right">{formatCurrency(totals.grandTotal)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

export default function Registers() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="sale">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">GST Registers</h1>
          <TabsList><TabsTrigger value="sale">Sale Register</TabsTrigger><TabsTrigger value="purchase">Purchase Register</TabsTrigger></TabsList>
        </div>
        <TabsContent value="sale"><Card><CardContent className="p-4"><SaleRegister /></CardContent></Card></TabsContent>
        <TabsContent value="purchase"><Card><CardContent className="p-4"><PurchaseRegister /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
