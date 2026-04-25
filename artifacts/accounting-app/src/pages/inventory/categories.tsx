import { useState } from "react";
import { useListStockCategories, useCreateStockCategory, useDeleteStockCategory, getListStockCategoriesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

export default function Categories() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { data: categories = [], isLoading } = useListStockCategories({});
  const createMutation = useCreateStockCategory();
  const deleteMutation = useDeleteStockCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ data: { name } as any });
    queryClient.invalidateQueries({ queryKey: getListStockCategoriesQueryKey() });
    setOpen(false);
    setName("");
    toast({ title: "Category created" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListStockCategoriesQueryKey() });
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Stock Categories</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Category</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Name *</Label><Input required value={name} onChange={e => setName(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : (categories as any[]).length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No categories</TableCell></TableRow>
                  : (categories as any[]).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right"><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}
