import { useState } from "react";
import { useGetSaleRegister, useGetPurchaseRegister } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/format";

function DateFilters({ from, to, setFrom, setTo }: any) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
      <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
    </div>
  );
}

function SaleRegister() {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const { data, isLoading } = useGetSaleRegister({ from: from || undefined, to: to || undefined });
  return (
    <>
      <DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice#</TableHead><TableHead>Party</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            : !(data as any)?.invoices?.length ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No data</TableCell></TableRow>
              : (data as any).invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.partyName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalTaxable)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalCgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalSgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalIgst)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </>
  );
}

function PurchaseRegister() {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const { data, isLoading } = useGetPurchaseRegister({ from: from || undefined, to: to || undefined });
  return (
    <>
      <DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice#</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            : !(data as any)?.invoices?.length ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No data</TableCell></TableRow>
              : (data as any).invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.partyName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalTaxable)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalCgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalSgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalIgst)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(inv.grandTotal)}</TableCell>
                </TableRow>
              ))}
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
