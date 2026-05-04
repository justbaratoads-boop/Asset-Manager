import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCreateStockItem, useGetStockItem, useListStockCategories, getListStockItemsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GST_RATES } from "@/lib/format";
import { useFetch } from "@/hooks/use-fetch";

export default function ItemForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEdit = !!params?.id;
  const editId = isEdit ? Number(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateStockItem();
  const { data: categories = [] } = useListStockCategories({});
  const { data: batches = [] } = useFetch<any[]>("/api/stock-batches");
  const { data: existing } = useGetStockItem(editId!, { query: { enabled: isEdit } });

  const [form, setForm] = useState({
    name: "", categoryId: "", batchId: "none", hsnCode: "", unit: "pcs",
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
      batchId: e.batchId ? String(e.batchId) : "none",
      hsnCode: e.hsnCode || "",
      unit: e.unit || "pcs",
      purchaseRate: String(e.purchaseRate || ""),
      saleRate: String(e.saleRate || ""),
      minStockLevel: String(e.minStockLevel || ""),
      physicalStock: String(e.physicalStock || e.openingStock || ""),
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
      batchId: form.batchId && form.batchId !== "none" ? Number(form.batchId) : undefined,
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
      const msg = err?.response?.data?.error || err.message || "Failed to save";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/inventory/items"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">{isEdit ? "Edit Stock Item" : "New Stock Item"}</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Item Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2">
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
            <Label>Batch</Label>
            <Select value={form.batchId} onValueChange={v => set("batchId", v)}>
              <SelectTrigger><SelectValue placeholder="Select batch (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(batches as any[]).map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>HSN Code</Label>
            <Input value={form.hsnCode} onChange={e => set("hsnCode", e.target.value)} placeholder="e.g. 8471" />
          </div>
          <div className="space-y-1">
            <Label>Unit</Label>
            <Select value={form.unit} onValueChange={v => set("unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["pcs", "kg", "g", "ltr", "ml", "mtr", "cm", "box", "pack", "dozen", "set"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Barcode</Label>
            <Input value={form.barcode} onChange={e => set("barcode", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">GST Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Switch checked={form.gstApplicable} onCheckedChange={v => set("gstApplicable", v)} />
            <Label className="cursor-pointer">GST Applicable</Label>
          </div>
          <div className="space-y-1">
            <Label>GST Rate</Label>
            <Select value={form.gstRate} onValueChange={v => set("gstRate", v)} disabled={!form.gstApplicable}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Pricing & Stock</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Purchase Rate</Label>
            <Input type="number" value={form.purchaseRate} onChange={e => set("purchaseRate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Sale Rate</Label>
            <Input type="number" value={form.saleRate} onChange={e => set("saleRate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Min Stock Level</Label>
            <Input type="number" value={form.minStockLevel} onChange={e => set("minStockLevel", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{isEdit ? "Physical Stock" : "Opening Stock"}</Label>
            <Input type="number" value={form.physicalStock} onChange={e => set("physicalStock", e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? "Saving..." : isEdit ? "Update Item" : "Create Item"}
      </Button>
    </form>
  );
}
