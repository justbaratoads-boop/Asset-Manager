import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const roleColors: Record<string, string> = { admin: "bg-red-100 text-red-700", accountant: "bg-blue-100 text-blue-700", sales_staff: "bg-green-100 text-green-700", view_only: "bg-gray-100 text-gray-700" };

export default function UsersSettings() {
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "accountant" });
  const { data: users = [], isLoading } = useListUsers({});
  const createMutation = useCreateUser();
  const updateRoleMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ data: form as any });
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    setOpen(false);
    setForm({ name: "", email: "", password: "", role: "accountant" });
    toast({ title: "User created" });
  };

  const handleRoleChange = async (id: number, role: string) => {
    await updateRoleMutation.mutateAsync({ id, data: { role } as any });
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    toast({ title: "Role updated" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    setDeleteId(null);
    toast({ title: "User deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">User Management</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Full Name *</Label><Input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Email *</Label><Input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Password *</Label><Input type="password" required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Role</Label><Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="accountant">Accountant</SelectItem><SelectItem value="sales_staff">Sales Staff</SelectItem><SelectItem value="view_only">View Only</SelectItem></SelectContent></Select></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create User</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
                : (users as any[]).map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {(currentUser as any)?.role === "admin" && u.id !== (currentUser as any)?.id ? (
                        <Select value={u.role} onValueChange={v => handleRoleChange(u.id, v)}>
                          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="accountant">Accountant</SelectItem><SelectItem value="sales_staff">Sales Staff</SelectItem><SelectItem value="view_only">View Only</SelectItem></SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`capitalize ${roleColors[u.role] || ""}`}>{u.role?.replace("_", " ")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.id !== (currentUser as any)?.id && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </TableCell>
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
