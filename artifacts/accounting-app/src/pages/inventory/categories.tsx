import { useState } from "react";
import { useListStockCategories, useCreateStockCategory, useDeleteStockCategory, getListStockCategoriesQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Pencil, Check, X, Lock } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

export default function Categories() {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);

  const { data: categories = [], isLoading } = useListStockCategories({});
  const createMutation = useCreateStockCategory();
  const deleteMutation = useDeleteStockCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createMutation.mutateAsync({ data: { name: name.trim() } as any });
    queryClient.invalidateQueries({ queryKey: getListStockCategoriesQueryKey() });
    setOpen(false);
    setName("");
    toast({ title: "Category created" });
  };

  const startEdit = (c: any) => {
    setEditId(c.id);
    setEditName(c.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !editName.trim()) return;
    setIsSaving(true);
    try {
      await customFetch(`/api/stock-categories/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      queryClient.invalidateQueries({ queryKey: getListStockCategoriesQueryKey() });
      toast({ title: "Category renamed" });
      setEditId(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to rename category";
      toast({ title: "Cannot rename", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      queryClient.invalidateQueries({ queryKey: getListStockCategoriesQueryKey() });
      toast({ title: "Category deleted" });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Failed to delete category";
      toast({ title: "Cannot delete", description: msg, variant: "destructive" });
    }
    setDeleteId(null);
  };

  const list = categories as any[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Stock Categories</h1>
          <p className="text-sm text-muted-foreground">{list.length} categories</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input required value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="e.g. Electronics, Chemicals" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-28 text-center">Items</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No categories yet</TableCell></TableRow>
              ) : paginated.map((c: any) => {
                const inUse = c.itemCount > 0;
                const isEditing = editId === c.id;

                return (
                  <TableRow key={c.id}>
                    {isEditing ? (
                      <TableCell colSpan={2}>
                        <form onSubmit={handleEdit} className="flex items-center gap-2">
                          <Input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                            className="h-8 text-sm max-w-xs"
                            required
                          />
                          <Button type="submit" size="icon" variant="default" className="h-8 w-8" disabled={isSaving}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </TableCell>
                    ) : (
                      <>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-center">
                          {inUse ? (
                            <span className="text-xs text-muted-foreground">{c.itemCount} item{c.itemCount !== 1 ? "s" : ""}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </>
                    )}

                    <TableCell className="text-right">
                      {isEditing ? null : inUse ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-end gap-1 text-muted-foreground/50 cursor-default px-1">
                                <Lock className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              Cannot edit or delete — {c.itemCount} item{c.itemCount !== 1 ? "s are" : " is"} assigned to this category
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            onClick={() => setDeleteId(c.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={o => !o && setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
