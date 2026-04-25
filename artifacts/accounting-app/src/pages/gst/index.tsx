import { useState } from "react";
import { useGetGstr3b, useGetGstr2b, useGetHsnSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";

function GSTR3B({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useGetGstr3b({ from: from || undefined, to: to || undefined });
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!data) return <p className="text-muted-foreground">No data</p>;
  const d = data as any;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Sales</p><p className="text-xl font-bold">{formatCurrency(d.totalSales)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Taxable</p><p className="text-xl font-bold">{formatCurrency(d.taxableSales)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Output GST</p><p className="text-xl font-bold text-red-600">{formatCurrency(d.outputGst)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Net Payable</p><p className="text-xl font-bold text-blue-600">{formatCurrency(d.netPayable)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">3.1 Outward Supplies</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nature</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell>B2B (Registered)</TableCell><TableCell className="text-right">{formatCurrency(d.b2bTaxable)}</TableCell><TableCell className="text-right">{formatCurrency(d.b2bCgst)}</TableCell><TableCell className="text-right">{formatCurrency(d.b2bSgst)}</TableCell><TableCell className="text-right">{formatCurrency(d.b2bIgst)}</TableCell></TableRow>
              <TableRow><TableCell>B2C (Others)</TableCell><TableCell className="text-right">{formatCurrency(d.b2cTaxable)}</TableCell><TableCell className="text-right">{formatCurrency(d.b2cCgst)}</TableCell><TableCell className="text-right">{formatCurrency(d.b2cSgst)}</TableCell><TableCell className="text-right">{formatCurrency(d.b2cIgst)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">4. Eligible ITC</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Input Tax Credit (Purchases)</span><span>{formatCurrency(d.inputTaxCredit)}</span></div>
          <div className="flex justify-between font-bold border-t pt-2"><span>Net GST Payable</span><span className={d.netPayable >= 0 ? "text-red-600" : "text-green-600"}>{formatCurrency(Math.abs(d.netPayable))}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}

function GSTR2B({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useGetGstr2b({ from: from || undefined, to: to || undefined });
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  const d = data as any;
  return (
    <Card>
      <CardContent className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Invoice#</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead></TableRow></TableHeader>
          <TableBody>
            {!d?.invoices?.length ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No data</TableCell></TableRow>
              : d.invoices.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.partyName}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.supplierInvoiceNumber || inv.invoiceNumber}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalTaxable)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalCgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalSgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.totalIgst)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function HSNSummary({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useGetHsnSummary({ from: from || undefined, to: to || undefined });
  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  const d = data as any;
  return (
    <Card>
      <CardContent className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>HSN Code</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead><TableHead className="text-right">IGST</TableHead></TableRow></TableHeader>
          <TableBody>
            {!d?.rows?.length ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No HSN data</TableCell></TableRow>
              : d.rows.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{r.hsnCode}</TableCell>
                  <TableCell className="text-sm">{r.description || "-"}</TableCell>
                  <TableCell className="text-right">{r.totalQty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.taxable)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.cgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.sgst)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.igst)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function GSTDashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">GST Compliance</h1>
        <div className="flex gap-3">
          <div className="flex items-center gap-2"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36" /></div>
          <div className="flex items-center gap-2"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36" /></div>
        </div>
      </div>
      <Tabs defaultValue="gstr3b">
        <TabsList><TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger><TabsTrigger value="gstr2b">GSTR-2B (ITC)</TabsTrigger><TabsTrigger value="hsn">HSN Summary</TabsTrigger></TabsList>
        <TabsContent value="gstr3b" className="mt-4"><GSTR3B from={from} to={to} /></TabsContent>
        <TabsContent value="gstr2b" className="mt-4"><GSTR2B from={from} to={to} /></TabsContent>
        <TabsContent value="hsn" className="mt-4"><HSNSummary from={from} to={to} /></TabsContent>
      </Tabs>
    </div>
  );
}
