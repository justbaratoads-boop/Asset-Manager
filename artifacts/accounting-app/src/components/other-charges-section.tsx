import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

export interface OtherCharge {
  name: string;
  amount: number;
}

const PRESET_CHARGES = [
  "Freight / Delivery",
  "Labour Charges",
  "Packing Charges",
  "Loading / Unloading",
  "Installation Charges",
  "Transportation",
  "Insurance",
  "Other",
];

interface Props {
  charges: OtherCharge[];
  onChange: (charges: OtherCharge[]) => void;
}

export function OtherChargesSection({ charges, onChange }: Props) {
  const add = () => onChange([...charges, { name: "", amount: 0 }]);
  const remove = (i: number) => onChange(charges.filter((_, j) => j !== i));
  const update = (i: number, field: keyof OtherCharge, value: string) => {
    const updated = [...charges];
    updated[i] = {
      ...updated[i],
      [field]: field === "amount" ? Number(value) || 0 : value,
    };
    onChange(updated);
  };
  const total = charges.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Other Charges</span>
        <Button type="button" variant="outline" size="sm" onClick={add} className="h-7 text-xs gap-1 px-2">
          <Plus className="h-3.5 w-3.5" />Add Charge
        </Button>
      </div>

      {charges.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">
          No other charges. Click "Add Charge" to add freight, labour, packing, etc.
        </p>
      )}

      {charges.map((charge, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <Input
              list={`charge-presets-${i}`}
              value={charge.name}
              onChange={e => update(i, "name", e.target.value)}
              placeholder="e.g. Freight / Delivery"
              className="h-9 text-sm"
            />
            <datalist id={`charge-presets-${i}`}>
              {PRESET_CHARGES.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
          <div className="relative w-32 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">₹</span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={charge.amount || ""}
              onChange={e => update(i, "amount", e.target.value)}
              placeholder="0.00"
              className="pl-7 h-9 text-sm"
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 text-destructive shrink-0"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {charges.length > 0 && total > 0 && (
        <div className="flex justify-between text-sm font-medium pt-1 border-t border-border/50">
          <span className="text-muted-foreground">Other Charges Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      )}
    </div>
  );
}
