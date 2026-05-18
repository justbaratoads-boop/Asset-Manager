import { useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useGetCreditNote, useGetCompanySettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { Printer, ArrowLeft } from "lucide-react";

export default function CreditNoteView() {
  const [, params] = useRoute("/accounts/credit-notes/:id");
  const id = Number(params?.id);
  const autoPrint = new URLSearchParams(window.location.search).get("print") === "1";

  const { data: note } = useGetCreditNote(id, { query: { enabled: !!id } });
  const { data: company } = useGetCompanySettings();

  useEffect(() => {
    if (note && autoPrint) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [note, autoPrint]);

  if (!note) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const n = note as any;
  const items: any[] = n.items || [];
  const co = company as any;

  const taxable = items.reduce((s, i) => s + Number(i.taxableAmount), 0);
  const cgst = items.reduce((s, i) => s + Number(i.cgst), 0);
  const sgst = items.reduce((s, i) => s + Number(i.sgst), 0);
  const igst = items.reduce((s, i) => s + Number(i.igst), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 print:hidden">
        <Button type="button" variant="ghost" size="sm" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />Print</Button>
        <Link href={`/accounts/credit-notes/${id}/edit`}>
          <Button variant="outline" size="sm">Edit</Button>
        </Link>
      </div>

      <div className="bg-white border rounded-xl p-6 sm:p-10 max-w-3xl mx-auto text-black" id="note-print">
        {/* Company header */}
        <div className="text-center mb-6 pb-4 border-b">
          {co?.name && <h1 className="text-2xl font-bold">{co.name}</h1>}
          {co?.address && <p className="text-sm text-gray-600 mt-1">{co.address}</p>}
          {co?.phone && <p className="text-sm text-gray-600">{co.phone}</p>}
          {co?.gstin && <p className="text-sm text-gray-600 font-medium">GSTIN: {co.gstin}</p>}
        </div>

        {/* Note title */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold border border-black inline-block px-6 py-1">CREDIT NOTE</h2>
          <p className="text-xs text-gray-500 mt-1">(Sale Return — Stock Increases)</p>
        </div>

        {/* Note info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="space-y-1">
            <p><span className="font-semibold">Note No:</span> {n.noteNumber}</p>
            <p><span className="font-semibold">Date:</span> {formatDate(n.date)}</p>
          </div>
          <div className="space-y-1">
            <p><span className="font-semibold">Customer:</span> {n.partyName}</p>
          </div>
        </div>

        {n.reason && (
          <div className="mb-4 text-sm border rounded p-3 bg-gray-50">
            <span className="font-semibold">Reason: </span>{n.reason}
          </div>
        )}

        {/* Items table */}
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="border-y-2 border-black">
              <th className="text-left py-2 pr-2">#</th>
              <th className="text-left py-2">Item</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Unit</th>
              <th className="text-right py-2">Rate</th>
              <th className="text-right py-2">GST%</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1.5 pr-2">{i + 1}</td>
                <td className="py-1.5">{item.itemName}</td>
                <td className="py-1.5 text-right">{Number(item.quantity)}</td>
                <td className="py-1.5 text-right">{item.unit}</td>
                <td className="py-1.5 text-right">{formatCurrency(Number(item.rate))}</td>
                <td className="py-1.5 text-right">{Number(item.gstPct)}%</td>
                <td className="py-1.5 text-right font-medium">{formatCurrency(Number(item.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 text-sm space-y-1 border-t pt-2">
            <div className="flex justify-between"><span className="text-gray-600">Taxable Amount</span><span>{formatCurrency(taxable)}</span></div>
            {cgst > 0 && (
              <>
                <div className="flex justify-between"><span className="text-gray-600">CGST</span><span>{formatCurrency(cgst)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">SGST</span><span>{formatCurrency(sgst)}</span></div>
              </>
            )}
            {igst > 0 && <div className="flex justify-between"><span className="text-gray-600">IGST</span><span>{formatCurrency(igst)}</span></div>}
            {(() => {
              let parsedCharges: {name: string; amount: number}[] = [];
              try { parsedCharges = JSON.parse(n.otherCharges || "[]"); } catch {}
              return parsedCharges.map((c, i) => (
                <div key={i} className="flex justify-between"><span className="text-gray-600">{c.name || "Other Charges"}</span><span>{formatCurrency(Number(c.amount))}</span></div>
              ));
            })()}
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Credit Amount</span>
              <span className="text-green-700">{formatCurrency(Number(n.amount))}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">This is a computer generated credit note.</p>
      </div>

      <style>{`
        @media print {
          body > * { display: none; }
          #note-print { display: block !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
