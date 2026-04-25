import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateStockItem, useListStockCategories, getListStockItemsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ItemForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateStockItem();
  const { data: categories = [] } = useListStockCategories({});
  const [form, setForm] = useState({ name: "", categoryId: "", brand: "", hsnCode: "", unit: "pcs", purchaseRate: "", saleRate: "", minStockLevel: "", physicalStock: "", barcode: "" });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({ data: { ...form, categoryId: form.categoryId ? Number(form.categoryId) : undefined, purchaseRate: Number(form.purchaseRate) || 0, saleRate: Number(form.saleRate) || 0, minStockLevel: Number(form.minStockLevel) || 0, physicalStock: Number(form.physicalStock) || 0 } as any });
      queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
      toast({ title: "Item created" });
      setLocation("/inventory/items");
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/inventory/items"><Button type="button" variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <h1 className="text-xl font-bold">New Stock Item</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Item Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2"><Label>Name *</Label><Input required value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="space-y-1"><Label>Category</Label><Select value={form.categoryId} onValueChange={v => set("categoryId", v)}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{(categories as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Brand</Label><Input value={form.brand} onChange={e => set("brand", e.target.value)} /></div>
          <div className="space-y-1"><Label>HSN Code</Label><Input value={form.hsnCode} onChange={e => set("hsnCode", e.target.value)} placeholder="e.g. 8471" /></div>
          <div className="space-y-1"><Label>Unit</Label>
            <Select value={form.unit} onValueChange={v => set("unit", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["pcs","kg","g","ltr","ml","mtr","cm","box","pack","dozen","set"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>Barcode</Label><Input value={form.barcode} onChange={e => set("barcode", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing & Stock</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-1"><Label>Purchase Rate</Label><Input type="number" value={form.purchaseRate} onChange={e => set("purchaseRate", e.target.value)} /></div>
          <div className="space-y-1"><Label>Sale Rate</Label><Input type="number" value={form.saleRate} onChange={e => set("saleRate", e.target.value)} /></div>
          <div className="space-y-1"><Label>Min Stock Level</Label><Input type="number" value={form.minStockLevel} onChange={e => set("minStockLevel", e.target.value)} /></div>
          <div className="space-y-1"><Label>Opening Stock</Label><Input type="number" value={form.physicalStock} onChange={e => set("physicalStock", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Create Item"}</Button>
    </form>
  );
}
