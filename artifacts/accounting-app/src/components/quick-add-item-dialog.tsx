import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UnitSelect } from "@/components/unit-select";
import { useCreateStockItem, useListStockCategories, getListStockItemsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { GST_RATES } from "@/lib/format";

interface QuickAddItemDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: (item: any) => void;
}

const BLANK = {
  name: "", categoryId: "", hsnCode: "", unit: "pcs",
  purchaseRate: "", saleRate: "",
  minStockLevel: "", openingStock: "",
  barcode: "",
  gstApplicable: true, gstRate: "18",
};

export function QuickAddItemDialog({ open, onClose, onAdded }: QuickAddItemDialogProps) {
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const createItem = useCreateStockItem();
  const { data: categories = [] } = useListStockCategories({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  const handleClose = () => {
    if (saving) return;
    setForm({ ...BLANK });
    onClose();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Item name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const item = await createItem.mutateAsync({
        data: {
          name: form.name.trim(),
          categoryId: form.categoryId ? Number(form.categoryId) : undefined,
          hsnCode: form.hsnCode || undefined,
          unit: form.unit,
          purchaseRate: form.purchaseRate || "0",
          saleRate: form.saleRate || "0",
          minStockLevel: form.minStockLevel || "0",
          openingStock: form.openingStock || "0",
          barcode: form.barcode || undefined,
          gstApplicable: String(form.gstApplicable),
          gstRate: form.gstRate,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
      toast({ title: `Item "${form.name}" created` });
      onAdded(item);
      setForm({ ...BLANK });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to create item", description: err?.data?.error || "Please try again", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">

          {/* Item Details */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item Details</p>

            <div className="space-y-1">
              <Label>Name *</Label>
              <Input autoFocus value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="e.g. Cement 50kg" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={v => set("categoryId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {(categories as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>HSN Code</Label>
                <Input value={form.hsnCode} onChange={e => set("hsnCode", e.target.value)}
                  placeholder="e.g. 8471" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Unit</Label>
              <UnitSelect value={form.unit} onChange={v => set("unit", v)} className="h-9" />
            </div>
          </div>

          {/* GST Settings */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GST Settings</p>

            <div className="flex items-center gap-3">
              <Switch checked={form.gstApplicable} onCheckedChange={v => set("gstApplicable", v)} id="gst-applicable" />
              <Label htmlFor="gst-applicable" className="cursor-pointer">GST Applicable</Label>
            </div>

            <div className="space-y-1">
              <Label>GST Rate</Label>
              <Select value={form.gstRate} onValueChange={v => set("gstRate", v)} disabled={!form.gstApplicable}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing & Stock</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Purchase Rate</Label>
                <Input type="number" inputMode="decimal" min="0" step="any"
                  value={form.purchaseRate} onChange={e => set("purchaseRate", e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Sale Rate</Label>
                <Input type="number" inputMode="decimal" min="0" step="any"
                  value={form.saleRate} onChange={e => set("saleRate", e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Min Stock Level</Label>
                <Input type="number" inputMode="decimal" min="0" step="any"
                  value={form.minStockLevel} onChange={e => set("minStockLevel", e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Opening Stock</Label>
                <Input type="number" inputMode="decimal" min="0" step="any"
                  value={form.openingStock} onChange={e => set("openingStock", e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Barcode</Label>
              <Input value={form.barcode} onChange={e => set("barcode", e.target.value)}
                placeholder="Scan or enter barcode" />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
