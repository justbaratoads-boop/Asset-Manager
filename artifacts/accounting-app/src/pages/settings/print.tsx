import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Printer } from "lucide-react";

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
};

function loadSettings(): PrintSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT, ...JSON.parse(saved) } : DEFAULT;
  } catch { return DEFAULT; }
}

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

  const printerTypeInfo = {
    a4: "Standard A4 laser/inkjet printer — full-width invoice",
    a5: "A5 half-page printer — compact invoice",
    thermal: "2-inch or 3-inch thermal/POS receipt printer",
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Print Settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" />Printer Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Printer / Paper Type</Label>
            <Select value={settings.printerType} onValueChange={v => set("printerType", v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4 — Standard Printer</SelectItem>
                <SelectItem value="a5">A5 — Half Page</SelectItem>
                <SelectItem value="thermal">Thermal / POS Printer</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{printerTypeInfo[settings.printerType]}</p>
          </div>

          <div className="space-y-1">
            <Label>Invoice Copies</Label>
            <Select value={settings.invoiceCopies} onValueChange={v => set("invoiceCopies", v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
