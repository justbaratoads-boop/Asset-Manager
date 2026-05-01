import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface Batch {
  id: number;
  name: string;
  description?: string;
  expiryDate?: string;
  createdAt?: string;
}

function BatchDialog({ batch, onSaved, onClose }: { batch?: Batch; onSaved: () => void; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: batch?.name || "", description: batch?.description || "", expiryDate: batch?.expiryDate || "" });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: "Batch name is required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      if (batch) {
        await customFetch(`/api/stock-batches/${batch.id}`, { method: "PUT", body: JSON.stringify(form), headers: { "Content-Type": "application/json" } });
      } else {
        await customFetch("/api/stock-batches", { method: "POST", body: JSON.stringify(form), headers: { "Content-Type": "application/json" } });
      }
      toast({ title: batch ? "Batch updated" : "Batch created" });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>Batch Name *</Label>
        <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Batch-2024-A" />
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Optional description" />
      </div>
      <div className="space-y-1">
        <Label>Expiry Date</Label>
        <Input type="date" value={form.expiryDate} onChange={e => set("expiryDate", e.target.value)} />
      </div>
      <Button type="submit" disabled={loading}>{loading ? "Saving..." : batch ? "Update Batch" : "Create Batch"}</Button>
    </form>
  );
}

export default function Batches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: batches = [], isLoading } = useFetch<Batch[]>("/api/stock-batches");
  const [newOpen, setNewOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/stock-batches"] });

  const deleteBatch = async (id: number) => {
    if (!confirm("Delete this batch?")) return;
    try {
      await customFetch(`/api/stock-batches/${id}`, { method: "DELETE" });
      toast({ title: "Batch deleted" });
      invalidate();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Stock Batches</h1>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />New Batch</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Batch</DialogTitle></DialogHeader>
            <BatchDialog onSaved={invalidate} onClose={() => setNewOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Batches</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (batches as Batch[]).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No batches yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(batches as Batch[]).map(batch => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell className="text-muted-foreground">{batch.description || "—"}</TableCell>
                    <TableCell>{batch.expiryDate || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog open={editBatch?.id === batch.id} onOpenChange={open => !open && setEditBatch(null)}>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditBatch(batch)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Edit Batch</DialogTitle></DialogHeader>
                            {editBatch?.id === batch.id && (
                              <BatchDialog batch={editBatch} onSaved={invalidate} onClose={() => setEditBatch(null)} />
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteBatch(batch.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
