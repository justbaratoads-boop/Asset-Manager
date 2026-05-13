import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Printer, Check } from "lucide-react";

const STORAGE_KEY = "print_settings";

interface PrintSettings {
  printerType: "a4" | "a5" | "thermal";
  showLogo: boolean;
  showCompanyName: boolean;
  showAddress: boolean;
  showGstin: boolean;
  showPartyGstin: boolean;
  showHsnCode: boolean;
  showBankDetails: boolean;
  showSignatureLine: boolean;
  showFooter: boolean;
  invoiceCopies: "1" | "2" | "3";
  copyLabels: string;
  billTitle: string;
  termsAndConditions: string;
  printAcknowledgment: boolean;
}

const DEFAULT: PrintSettings = {
  printerType: "a4",
  showLogo: true,
  showCompanyName: true,
  showAddress: true,
  showGstin: true,
  showPartyGstin: true,
  showHsnCode: true,
  showBankDetails: true,
  showSignatureLine: true,
  showFooter: true,
  invoiceCopies: "1",
  copyLabels: "Original, Duplicate, Triplicate",
  billTitle: "TAX INVOICE",
  termsAndConditions: "",
  printAcknowledgment: false,
};

function loadSettings(): PrintSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT, ...JSON.parse(saved) } : DEFAULT;
  } catch { return DEFAULT; }
}

function A4Preview() {
  return (
    <svg viewBox="0 0 120 170" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="170" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2" />
      {/* Header row: logo box + title */}
      <rect x="8" y="10" width="20" height="14" rx="2" fill="#e0e7ff" />
      <rect x="32" y="11" width="40" height="4" rx="1" fill="#374151" />
      <rect x="32" y="17" width="28" height="2.5" rx="1" fill="#9ca3af" />
      <rect x="32" y="21" width="22" height="2" rx="1" fill="#9ca3af" />
      <rect x="82" y="10" width="30" height="6" rx="1" fill="#4f46e5" opacity="0.8" />
      <rect x="88" y="19" width="22" height="2.5" rx="1" fill="#9ca3af" />
      <rect x="92" y="23" width="16" height="2" rx="1" fill="#9ca3af" />
      {/* Divider */}
      <line x1="8" y1="32" x2="112" y2="32" stroke="#e5e7eb" strokeWidth="0.8" />
      {/* Bill to */}
      <rect x="8" y="35" width="16" height="2" rx="1" fill="#9ca3af" />
      <rect x="8" y="39" width="38" height="3" rx="1" fill="#374151" />
      <rect x="8" y="44" width="28" height="2" rx="1" fill="#9ca3af" />
      {/* Table header */}
      <rect x="8" y="52" width="104" height="6" rx="1" fill="#f3f4f6" />
      <rect x="10" y="54" width="8" height="2" rx="0.5" fill="#6b7280" />
      <rect x="24" y="54" width="22" height="2" rx="0.5" fill="#6b7280" />
      <rect x="66" y="54" width="10" height="2" rx="0.5" fill="#6b7280" />
      <rect x="82" y="54" width="10" height="2" rx="0.5" fill="#6b7280" />
      <rect x="98" y="54" width="12" height="2" rx="0.5" fill="#6b7280" />
      {/* Table rows */}
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          <rect x="10" y={62 + i * 9} width="6" height="2" rx="0.5" fill="#9ca3af" />
          <rect x="22" y={62 + i * 9} width="28" height="2" rx="0.5" fill="#374151" />
          <rect x="66" y={62 + i * 9} width="10" height="2" rx="0.5" fill="#9ca3af" />
          <rect x="82" y={62 + i * 9} width="12" height="2" rx="0.5" fill="#9ca3af" />
          <rect x="98" y={62 + i * 9} width="12" height="2" rx="0.5" fill="#374151" />
          <line x1="8" y1={67 + i * 9} x2="112" y2={67 + i * 9} stroke="#f3f4f6" strokeWidth="0.5" />
        </g>
      ))}
      {/* Totals block */}
      <rect x="70" y="102" width="42" height="2" rx="0.5" fill="#9ca3af" />
      <rect x="70" y="107" width="42" height="2" rx="0.5" fill="#9ca3af" />
      <line x1="70" y1="112" x2="112" y2="112" stroke="#e5e7eb" strokeWidth="0.8" />
      <rect x="70" y="115" width="42" height="3.5" rx="0.5" fill="#374151" />
      {/* Bank + Terms */}
      <line x1="8" y1="126" x2="112" y2="126" stroke="#e5e7eb" strokeWidth="0.8" />
      <rect x="8" y="129" width="30" height="2" rx="0.5" fill="#9ca3af" />
      <rect x="8" y="133" width="50" height="2" rx="0.5" fill="#9ca3af" />
      {/* Signature lines */}
      <line x1="8" y1="152" x2="40" y2="152" stroke="#9ca3af" strokeWidth="0.8" />
      <line x1="80" y1="152" x2="112" y2="152" stroke="#9ca3af" strokeWidth="0.8" />
      <rect x="12" y="155" width="22" height="1.5" rx="0.5" fill="#d1d5db" />
      <rect x="76" y="155" width="32" height="1.5" rx="0.5" fill="#d1d5db" />
    </svg>
  );
}

function A5Preview() {
  return (
    <svg viewBox="0 0 100 142" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="142" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2" />
      {/* Header */}
      <rect x="6" y="8" width="14" height="10" rx="1.5" fill="#e0e7ff" />
      <rect x="24" y="9" width="30" height="3" rx="1" fill="#374151" />
      <rect x="24" y="14" width="20" height="2" rx="0.8" fill="#9ca3af" />
      <rect x="70" y="8" width="24" height="5" rx="1" fill="#4f46e5" opacity="0.8" />
      <rect x="74" y="15" width="18" height="2" rx="0.8" fill="#9ca3af" />
      {/* Divider */}
      <line x1="6" y1="25" x2="94" y2="25" stroke="#e5e7eb" strokeWidth="0.8" />
      {/* Bill to */}
      <rect x="6" y="28" width="12" height="1.8" rx="0.5" fill="#9ca3af" />
      <rect x="6" y="31.5" width="30" height="2.5" rx="0.8" fill="#374151" />
      <rect x="6" y="35.5" width="22" height="1.8" rx="0.5" fill="#9ca3af" />
      {/* Table header */}
      <rect x="6" y="42" width="88" height="5" rx="1" fill="#f3f4f6" />
      <rect x="8" y="43.5" width="16" height="1.8" rx="0.5" fill="#6b7280" />
      <rect x="50" y="43.5" width="10" height="1.8" rx="0.5" fill="#6b7280" />
      <rect x="70" y="43.5" width="10" height="1.8" rx="0.5" fill="#6b7280" />
      <rect x="82" y="43.5" width="10" height="1.8" rx="0.5" fill="#6b7280" />
      {/* Table rows */}
      {[0, 1, 2].map(i => (
        <g key={i}>
          <rect x="8" y={51 + i * 8} width="22" height="1.8" rx="0.5" fill="#374151" />
          <rect x="50" y={51 + i * 8} width="10" height="1.8" rx="0.5" fill="#9ca3af" />
          <rect x="70" y={51 + i * 8} width="10" height="1.8" rx="0.5" fill="#9ca3af" />
          <rect x="82" y={51 + i * 8} width="10" height="1.8" rx="0.5" fill="#374151" />
          <line x1="6" y1={55 + i * 8} x2="94" y2={55 + i * 8} stroke="#f3f4f6" strokeWidth="0.5" />
        </g>
      ))}
      {/* Totals */}
      <rect x="58" y="82" width="36" height="1.8" rx="0.5" fill="#9ca3af" />
      <rect x="58" y="86" width="36" height="1.8" rx="0.5" fill="#9ca3af" />
      <line x1="58" y1="90" x2="94" y2="90" stroke="#e5e7eb" strokeWidth="0.8" />
      <rect x="58" y="92.5" width="36" height="3" rx="0.5" fill="#374151" />
      {/* Footer */}
      <line x1="6" y1="102" x2="94" y2="102" stroke="#e5e7eb" strokeWidth="0.8" />
      <rect x="6" y="105" width="40" height="1.8" rx="0.5" fill="#9ca3af" />
      <rect x="6" y="109" width="30" height="1.8" rx="0.5" fill="#9ca3af" />
      {/* Signature */}
      <line x1="6" y1="128" x2="32" y2="128" stroke="#9ca3af" strokeWidth="0.8" />
      <line x1="68" y1="128" x2="94" y2="128" stroke="#9ca3af" strokeWidth="0.8" />
      <rect x="10" y="131" width="18" height="1.5" rx="0.5" fill="#d1d5db" />
      <rect x="64" y="131" width="26" height="1.5" rx="0.5" fill="#d1d5db" />
    </svg>
  );
}

function ThermalPreview() {
  return (
    <svg viewBox="0 0 70 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="70" height="200" fill="white" stroke="#e5e7eb" strokeWidth="1" rx="2" />
      {/* Logo / company name centered */}
      <rect x="20" y="8" width="30" height="8" rx="1.5" fill="#e0e7ff" />
      <rect x="10" y="19" width="50" height="3" rx="1" fill="#374151" />
      <rect x="14" y="24" width="42" height="2" rx="0.8" fill="#9ca3af" />
      <rect x="18" y="28" width="34" height="2" rx="0.8" fill="#9ca3af" />
      {/* Dashed divider */}
      <line x1="4" y1="34" x2="66" y2="34" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2" />
      {/* Invoice title + number */}
      <rect x="16" y="37" width="38" height="4" rx="1" fill="#374151" />
      <rect x="20" y="43" width="30" height="2.5" rx="0.8" fill="#6b7280" />
      <rect x="22" y="47" width="26" height="2" rx="0.8" fill="#9ca3af" />
      {/* Dashed divider */}
      <line x1="4" y1="53" x2="66" y2="53" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2" />
      {/* Bill to */}
      <rect x="4" y="56" width="20" height="2" rx="0.5" fill="#9ca3af" />
      <rect x="4" y="60" width="40" height="2.5" rx="0.8" fill="#374151" />
      {/* Dashed divider */}
      <line x1="4" y1="67" x2="66" y2="67" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2" />
      {/* Items - full width rows */}
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          <rect x="4" y={71 + i * 13} width="38" height="2.5" rx="0.5" fill="#374151" />
          <rect x="4" y={75.5 + i * 13} width="20" height="2" rx="0.5" fill="#9ca3af" />
          <rect x="50" y={72 + i * 13} width="16" height="3.5" rx="0.5" fill="#374151" />
          <line x1="4" y1={84 + i * 13} x2="66" y2={84 + i * 13} stroke="#f3f4f6" strokeWidth="0.5" />
        </g>
      ))}
      {/* Dashed divider */}
      <line x1="4" y1="126" x2="66" y2="126" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2" />
      {/* Totals - right aligned style */}
      <rect x="4" y="129" width="28" height="2" rx="0.5" fill="#9ca3af" />
      <rect x="44" y="129" width="22" height="2" rx="0.5" fill="#9ca3af" />
      <rect x="4" y="134" width="20" height="2" rx="0.5" fill="#9ca3af" />
      <rect x="44" y="134" width="22" height="2" rx="0.5" fill="#9ca3af" />
      <line x1="4" y1="139" x2="66" y2="139" stroke="#d1d5db" strokeWidth="0.8" />
      <rect x="4" y="142" width="22" height="3.5" rx="0.5" fill="#374151" />
      <rect x="44" y="142" width="22" height="3.5" rx="0.5" fill="#374151" />
      {/* Dashed divider */}
      <line x1="4" y1="150" x2="66" y2="150" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2" />
      {/* Thank you + signature */}
      <rect x="14" y="154" width="42" height="2" rx="0.8" fill="#9ca3af" />
      <rect x="18" y="158" width="34" height="2" rx="0.8" fill="#9ca3af" />
      <line x1="14" y1="170" x2="56" y2="170" stroke="#9ca3af" strokeWidth="0.8" />
      <rect x="18" y="173" width="34" height="1.5" rx="0.5" fill="#d1d5db" />
      {/* Tear line */}
      <line x1="4" y1="185" x2="66" y2="185" stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3,2" />
      <rect x="28" y="188" width="14" height="2" rx="0.5" fill="#e5e7eb" />
    </svg>
  );
}

const FORMAT_OPTIONS: { value: "a4" | "a5" | "thermal"; label: string; size: string; desc: string; preview: () => JSX.Element }[] = [
  {
    value: "a4",
    label: "A4",
    size: "210 × 297 mm",
    desc: "Standard laser/inkjet printer. Full-width invoice with all fields, tables and bank details.",
    preview: () => <A4Preview />,
  },
  {
    value: "a5",
    label: "A5",
    size: "148 × 210 mm",
    desc: "Compact half-page format. Same details as A4 but in a smaller, space-saving layout.",
    preview: () => <A5Preview />,
  },
  {
    value: "thermal",
    label: "Thermal",
    size: "80 mm roll",
    desc: "POS / thermal receipt printer. Narrow strip, monospace font, dotted separators between sections.",
    preview: () => <ThermalPreview />,
  },
];

export default function PrintSettings() {
  const [settings, setSettings] = useState<PrintSettings>(loadSettings);
  const { toast } = useToast();

  const set = <K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) => {
    setSettings(prev => ({ ...prev, [k]: v }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast({ title: "Print settings saved" });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Print Settings</h1>

      {/* Format selector */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" />Paper / Printer Format</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">Select a format below. The selected layout will be applied to all invoice prints.</p>
          <div className="grid grid-cols-3 gap-3">
            {FORMAT_OPTIONS.map(({ value, label, size, desc, preview }) => {
              const selected = settings.printerType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("printerType", value)}
                  className={`relative flex flex-col rounded-xl border-2 p-3 text-left transition-all focus:outline-none
                    ${selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-input bg-background hover:border-muted-foreground/50"
                    }`}
                >
                  {selected && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}

                  {/* Mini preview thumbnail */}
                  <div className={`w-full rounded overflow-hidden mb-3 bg-gray-50 border flex items-center justify-center
                    ${value === "thermal" ? "aspect-[1/2]" : value === "a5" ? "aspect-[5/7]" : "aspect-[3/4]"}`}
                  >
                    {preview()}
                  </div>

                  <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{label}</p>
                  <p className="text-xs text-muted-foreground">{size}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{desc}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Invoice Options</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Invoice Copies</Label>
            <Select value={settings.invoiceCopies} onValueChange={v => set("invoiceCopies", v as any)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Copy (Original)</SelectItem>
                <SelectItem value="2">2 Copies (Original + Duplicate)</SelectItem>
                <SelectItem value="3">3 Copies (Original + Duplicate + Triplicate)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {Number(settings.invoiceCopies) > 1 && (
            <div className="space-y-1">
              <Label>Copy Labels (comma-separated)</Label>
              <Input value={settings.copyLabels} onChange={e => set("copyLabels", e.target.value)} placeholder="Original, Duplicate, Triplicate" />
            </div>
          )}

          <div className="space-y-1">
            <Label>Bill / Invoice Title</Label>
            <Input value={settings.billTitle} onChange={e => set("billTitle", e.target.value)} placeholder="TAX INVOICE" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Fields to Print</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "showLogo", label: "Company Logo" },
              { key: "showCompanyName", label: "Company Name" },
              { key: "showAddress", label: "Company Address" },
              { key: "showGstin", label: "Company GSTIN" },
              { key: "showPartyGstin", label: "Customer GSTIN" },
              { key: "showHsnCode", label: "HSN Code Column" },
              { key: "showBankDetails", label: "Bank Details" },
              { key: "showSignatureLine", label: "Authorised Signature" },
              { key: "showFooter", label: "Footer / Terms" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="font-normal">{label}</Label>
                <Switch
                  checked={settings[key as keyof PrintSettings] as boolean}
                  onCheckedChange={v => set(key as keyof PrintSettings, v as any)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Acknowledgment Receipt</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Print Acknowledgment</p>
              <p className="text-xs text-muted-foreground">When enabled, a "Print Acknowledgment" button appears on every sale invoice. It prints a payment receipt confirming the customer has received the goods/amount.</p>
            </div>
            <Switch
              checked={settings.printAcknowledgment}
              onCheckedChange={v => set("printAcknowledgment", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Terms & Conditions</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={settings.termsAndConditions}
            onChange={e => set("termsAndConditions", e.target.value)}
            placeholder="e.g. Goods once sold will not be taken back. Subject to local jurisdiction."
            rows={4}
          />
          <p className="text-xs text-muted-foreground mt-1">Printed at the bottom of every invoice</p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave}>Save Print Settings</Button>
        <Button variant="outline" onClick={() => { setSettings(DEFAULT); localStorage.removeItem(STORAGE_KEY); toast({ title: "Reset to defaults" }); }}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
