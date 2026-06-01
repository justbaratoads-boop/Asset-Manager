import { useState } from "react";
import { useGetSaleRegister, useGetPurchaseRegister } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useFY } from "@/lib/financial-year";
import { useLocation } from "wouter";

function DateFilters({ from, to, setFrom, setTo }: any) {
  return (
    <div className="flex gap-3">
      <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
      <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
    </div>
  );
}

const SALE_COLUMNS = [
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

const PURCHASE_COLUMNS = [
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

const AMOUNT_KEYS = new Set(["totalTaxable", "totalCgst", "totalSgst", "totalIgst", "grandTotal"]);

function SaleRegister() {
  const { fy, globalFrom: from, globalTo: to } = useFY();
  
  
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetSaleRegister({ from, to });
  const invoices: any[] = (data as any)?.invoices || [];
  const totals = (data as any)?.totals || {};
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("sale-register", SALE_COLUMNS);
  const vis = visibleKeys;

  const labelCols = visibleColumns.filter(c => !AMOUNT_KEYS.has(c.key));

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        
        <div className="flex items-center gap-2">
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          <ExportButtons data={invoices} columns={visibleColumns} filename={`sale-register-${from}-${to}`} title="Sale Register" />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {vis.has("date") && <TableHead>Date</TableHead>}
            {vis.has("invoiceNumber") && <TableHead>Invoice#</TableHead>}
            {vis.has("partyName") && <TableHead>Party</TableHead>}
            {vis.has("partyGstin") && <TableHead>GSTIN</TableHead>}
            {vis.has("totalTaxable") && <TableHead className="text-right">Taxable</TableHead>}
            {vis.has("totalCgst") && <TableHead className="text-right">CGST</TableHead>}
            {vis.has("totalSgst") && <TableHead className="text-right">SGST</TableHead>}
            {vis.has("totalIgst") && <TableHead className="text-right">IGST</TableHead>}
            {vis.has("grandTotal") && <TableHead className="text-right">Total</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            : !invoices.length
              ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">No data for selected period</TableCell></TableRow>
              : invoices.map((inv: any) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/sales/invoices/${inv.id}`)}>
                  {vis.has("date") && <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>}
                  {vis.has("invoiceNumber") && <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>}
                  {vis.has("partyName") && <TableCell>{inv.partyName}</TableCell>}
                  {vis.has("partyGstin") && <TableCell className="text-xs text-muted-foreground">{inv.partyGstin || "-"}</TableCell>}
                  {vis.has("totalTaxable") && <TableCell className="text-right">{formatCurrency(inv.totalTaxable)}</TableCell>}
                  {vis.has("totalCgst") && <TableCell className="text-right">{formatCurrency(inv.totalCgst)}</TableCell>}
                  {vis.has("totalSgst") && <TableCell className="text-right">{formatCurrency(inv.totalSgst)}</TableCell>}
                  {vis.has("totalIgst") && <TableCell className="text-right">{formatCurrency(inv.totalIgst)}</TableCell>}
                  {vis.has("grandTotal") && <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>}
                </TableRow>
              ))
          }
          {invoices.length > 0 && (
            <TableRow className="font-bold bg-muted/30">
              <TableCell colSpan={labelCols.length}>Total ({invoices.length} invoices)</TableCell>
              {vis.has("totalTaxable") && <TableCell className="text-right">{formatCurrency(totals.taxable)}</TableCell>}
              {vis.has("totalCgst") && <TableCell className="text-right">{formatCurrency(totals.cgst)}</TableCell>}
              {vis.has("totalSgst") && <TableCell className="text-right">{formatCurrency(totals.sgst)}</TableCell>}
              {vis.has("totalIgst") && <TableCell className="text-right">{formatCurrency(totals.igst)}</TableCell>}
              {vis.has("grandTotal") && <TableCell className="text-right">{formatCurrency(totals.grandTotal)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

function PurchaseRegister() {
  const { fy, globalFrom: from, globalTo: to } = useFY();
  
  
  const [, setLocation] = useLocation();
  const { data, isLoading } = useGetPurchaseRegister({ from, to });
  const invoices: any[] = (data as any)?.invoices || [];
  const totals = (data as any)?.totals || {};
  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("purchase-register", PURCHASE_COLUMNS);
  const vis = visibleKeys;

  const labelCols = visibleColumns.filter(c => !AMOUNT_KEYS.has(c.key));

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        
        <div className="flex items-center gap-2">
          <ColumnSelector allColumns={allColumns} visibleKeys={vis} onToggle={toggle} onSelectAll={() => setAll(true)} onClearAll={() => setAll(false)} />
          <ExportButtons data={invoices} columns={visibleColumns} filename={`purchase-register-${from}-${to}`} title="Purchase Register" />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {vis.has("date") && <TableHead>Date</TableHead>}
            {vis.has("invoiceNumber") && <TableHead>Invoice#</TableHead>}
            {vis.has("supplierInvoiceNumber") && <TableHead>Supplier Inv#</TableHead>}
            {vis.has("partyName") && <TableHead>Supplier</TableHead>}
            {vis.has("totalTaxable") && <TableHead className="text-right">Taxable</TableHead>}
            {vis.has("totalCgst") && <TableHead className="text-right">CGST</TableHead>}
            {vis.has("totalSgst") && <TableHead className="text-right">SGST</TableHead>}
            {vis.has("totalIgst") && <TableHead className="text-right">IGST</TableHead>}
            {vis.has("grandTotal") && <TableHead className="text-right">Total</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            : !invoices.length
              ? <TableRow><TableCell colSpan={visibleColumns.length} className="text-center text-muted-foreground">No data for selected period</TableCell></TableRow>
              : invoices.map((inv: any) => (
                <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/purchase/invoices/${inv.id}/edit`)}>
                  {vis.has("date") && <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>}
                  {vis.has("invoiceNumber") && <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>}
                  {vis.has("supplierInvoiceNumber") && <TableCell className="font-mono text-xs">{inv.supplierInvoiceNumber || "-"}</TableCell>}
                  {vis.has("partyName") && <TableCell>{inv.partyName}</TableCell>}
                  {vis.has("totalTaxable") && <TableCell className="text-right">{formatCurrency(inv.totalTaxable)}</TableCell>}
                  {vis.has("totalCgst") && <TableCell className="text-right">{formatCurrency(inv.totalCgst)}</TableCell>}
                  {vis.has("totalSgst") && <TableCell className="text-right">{formatCurrency(inv.totalSgst)}</TableCell>}
                  {vis.has("totalIgst") && <TableCell className="text-right">{formatCurrency(inv.totalIgst)}</TableCell>}
                  {vis.has("grandTotal") && <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>}
                </TableRow>
              ))
          }
          {invoices.length > 0 && (
            <TableRow className="font-bold bg-muted/30">
              <TableCell colSpan={labelCols.length}>Total ({invoices.length} invoices)</TableCell>
              {vis.has("totalTaxable") && <TableCell className="text-right">{formatCurrency(totals.taxable)}</TableCell>}
              {vis.has("totalCgst") && <TableCell className="text-right">{formatCurrency(totals.cgst)}</TableCell>}
              {vis.has("totalSgst") && <TableCell className="text-right">{formatCurrency(totals.sgst)}</TableCell>}
              {vis.has("totalIgst") && <TableCell className="text-right">{formatCurrency(totals.igst)}</TableCell>}
              {vis.has("grandTotal") && <TableCell className="text-right">{formatCurrency(totals.grandTotal)}</TableCell>}
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


