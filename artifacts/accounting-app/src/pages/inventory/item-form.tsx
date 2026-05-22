import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCreateStockItem, useGetStockItem, useListStockCategories, getListStockItemsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnitSelect } from "@/components/unit-select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ItemForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateStockItem();
  const { data: categories = [] } = useListStockCategories({});
  const { data: existing } = useGetStockItem(editId!, { query: { enabled: isEdit } });

  const usedInBills = isEdit && !!(existing as any)?.usedInBills;

  const [form, setForm] = useState({
    name: "", categoryId: "", hsnCode: "", unit: "pcs",
    purchaseRate: "", saleRate: "", minStockLevel: "", physicalStock: "", barcode: "",
    gstApplicable: false, gstRate: "18",
  });
  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!existing) return;
    const e = existing as any;
    setForm({
      name: e.name || "",
      categoryId: e.categoryId ? String(e.categoryId) : "",
      hsnCode: e.hsnCode || "",
      unit: e.unit || "pcs",
      purchaseRate: String(e.purchaseRate || ""),
      saleRate: String(e.saleRate || ""),
      minStockLevel: String(e.minStockLevel || ""),
      physicalStock: String((e as any).unbatchedStock ?? e.physicalStock ?? e.openingStock ?? ""),
      barcode: e.barcode || "",
      gstApplicable: e.gstApplicable === "true" || e.gstApplicable === true,
      gstRate: String(e.gstRate || "18"),
    });
  }, [existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      hsnCode: form.hsnCode,
      unit: form.unit,
      purchaseRate: Number(form.purchaseRate) || 0,
      saleRate: Number(form.saleRate) || 0,
      minStockLevel: Number(form.minStockLevel) || 0,
      physicalStock: Number(form.physicalStock) || 0,
      barcode: form.barcode,
      gstApplicable: String(form.gstApplicable),
      gstRate: Number(form.gstRate) || 0,
    };
    try {
      if (isEdit) {
        await customFetch(`/api/stock-items/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast({ title: "Item updated" });
      } else {
        await createMutation.mutateAsync({ data: payload as any });
        toast({ title: "Item created" });
      }
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
      setLocation("/inventory/items");
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/inventory/items"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Stock Item" : "New Stock Item"}</h1>
      </div>

      {usedInBills && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Lock className="h-4 w-4 shrink-0" />
          <span>This item is used in bills. Changes will apply to future transactions only.</span>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Item Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1 sm:col-span-2">
            <Label>Name *</Label>
            <Input required value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={form.categoryId} onValueChange={v => set("categoryId", v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{(categories as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>HSN Code</Label>
            <Input value={form.hsnCode} onChange={e => set("hsnCode", e.target.value)} placeholder="e.g. 8471" />
          </div>
          <div className="space-y-1">
            <Label>Unit</Label>
            <UnitSelect value={form.unit} onChange={v => set("unit", v)} className="h-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">GST Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.gstApplicable} onCheckedChange={v => set("gstApplicable", v)} />
            <Label className="cursor-pointer">GST Applicable</Label>
          </div>
          <div className="space-y-1">
            <Label>GST Rate</Label>
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.gstRate}
                onChange={e => set("gstRate", e.target.value)}
                disabled={!form.gstApplicable}
                className="pr-7"
                placeholder="0"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pricing & Stock</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Purchase Rate</Label>
            <Input type="number" inputMode="decimal" min="0" step="any" value={form.purchaseRate} onChange={e => set("purchaseRate", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label>Sale Rate</Label>
            <Input type="number" inputMode="decimal" min="0" step="any" value={form.saleRate} onChange={e => set("saleRate", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label>Min Stock Level</Label>
            <Input type="number" inputMode="decimal" min="0" step="any" value={form.minStockLevel} onChange={e => set("minStockLevel", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label>{isEdit ? "Unbatched Physical Stock" : "Opening Stock (Unbatched)"}</Label>
            <Input type="number" inputMode="decimal" min="0" step="any" value={form.physicalStock} onChange={e => set("physicalStock", e.target.value)} placeholder="0" />
            <p className="text-xs text-muted-foreground">Stock not assigned to any batch. Total stock = this + sum of all batch stocks.</p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Saving..." : isEdit ? "Update Item" : "Create Item"}
      </Button>
    </form>
  );
}
