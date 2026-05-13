import { useState } from "react";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const PAGE_SIZE = 20;

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  accountant: "bg-blue-100 text-blue-700",
  sales_staff: "bg-green-100 text-green-700",
  view_only: "bg-gray-100 text-gray-700",
};

type PermKey =
  | "dashboard" | "sales_invoices" | "sales_orders"
  | "purchase_invoices" | "purchase_orders"
  | "accounts_parties" | "accounts_journal" | "accounts_payments"
  | "accounts_receipts" | "accounts_credit_notes" | "accounts_debit_notes"
  | "inventory_items" | "inventory_categories" | "inventory_stock" | "inventory_batches"
  | "reports" | "gst_reports" | "delivery"
  | "settings_company" | "settings_print" | "settings_users";

const ALL_PERMS: PermKey[] = [
  "dashboard", "sales_invoices", "sales_orders",
  "purchase_invoices", "purchase_orders",
  "accounts_parties", "accounts_journal", "accounts_payments",
  "accounts_receipts", "accounts_credit_notes", "accounts_debit_notes",
  "inventory_items", "inventory_categories", "inventory_stock", "inventory_batches",
  "reports", "gst_reports", "delivery",
  "settings_company", "settings_print", "settings_users",
];

const FEATURE_MODULES: { group: string; features: { key: PermKey; label: string; desc: string }[] }[] = [
  {
    group: "Dashboard",
    features: [
      { key: "dashboard", label: "Dashboard", desc: "Main overview with sales and business summary" },
    ],
  },
  {
    group: "Sales",
    features: [
      { key: "sales_invoices", label: "Sale Invoices", desc: "Create, view and manage sale invoices" },
      { key: "sales_orders", label: "Order Booking", desc: "Manage customer orders" },
    ],
  },
  {
    group: "Purchase",
    features: [
      { key: "purchase_invoices", label: "Purchase Invoices", desc: "Manage vendor / supplier invoices" },
      { key: "purchase_orders", label: "Purchase Orders", desc: "Create and track purchase orders" },
    ],
  },
  {
    group: "Accounts",
    features: [
      { key: "accounts_parties", label: "Parties & Ledger", desc: "Customers, suppliers and party ledgers" },
      { key: "accounts_journal", label: "Journal Entries", desc: "Manual accounting journal entries" },
      { key: "accounts_payments", label: "Payments", desc: "Record outgoing vendor payments" },
      { key: "accounts_receipts", label: "Receipts", desc: "Record incoming customer receipts" },
      { key: "accounts_credit_notes", label: "Credit Notes", desc: "Sales return credit notes" },
      { key: "accounts_debit_notes", label: "Debit Notes", desc: "Purchase return debit notes" },
    ],
  },
  {
    group: "Inventory",
    features: [
      { key: "inventory_items", label: "Stock Items", desc: "Product catalog and item management" },
      { key: "inventory_categories", label: "Categories", desc: "Product category management" },
      { key: "inventory_stock", label: "Current Stock", desc: "View current stock levels" },
      { key: "inventory_batches", label: "Batches", desc: "Batch tracking management" },
    ],
  },
  {
    group: "Reports & GST",
    features: [
      { key: "reports", label: "Reports", desc: "Day book, trial balance, P&L, balance sheet, registers" },
      { key: "gst_reports", label: "GST Reports", desc: "GSTR-3B, GSTR-2B and HSN summary" },
    ],
  },
  {
    group: "Delivery",
    features: [
      { key: "delivery", label: "Delivery & Logistics", desc: "Delivery challans, drivers and vehicles" },
    ],
  },
  {
    group: "Settings",
    features: [
      { key: "settings_company", label: "Company Settings", desc: "Company profile and configuration" },
      { key: "settings_print", label: "Print Settings", desc: "Invoice print format settings" },
      { key: "settings_users", label: "Users & Roles", desc: "Manage users and permissions (admin only)" },
    ],
  },
];

const ROLE_PRESETS: Record<string, PermKey[]> = {
  admin: ALL_PERMS,
  accountant: [
    "dashboard", "sales_invoices", "sales_orders",
    "purchase_invoices", "purchase_orders",
    "accounts_parties", "accounts_journal", "accounts_payments",
    "accounts_receipts", "accounts_credit_notes", "accounts_debit_notes",
    "inventory_items", "inventory_categories", "inventory_stock", "inventory_batches",
    "reports", "gst_reports",
    "settings_company", "settings_print",
  ],
  sales_staff: [
    "dashboard", "sales_invoices", "sales_orders",
    "accounts_parties", "inventory_items", "inventory_stock",
  ],
  view_only: ["dashboard", "reports", "gst_reports"],
};

function parsePermissions(raw: string | null | undefined): Record<PermKey, boolean> {
  const base = Object.fromEntries(ALL_PERMS.map((k) => [k, false])) as Record<PermKey, boolean>;
  try {
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      ALL_PERMS.forEach((k) => { base[k] = !!parsed[k]; });
    }
  } catch {}
  return base;
}

function permissionsFromRole(role: string): Record<PermKey, boolean> {
  const preset = ROLE_PRESETS[role] ?? [];
  const result = Object.fromEntries(ALL_PERMS.map((k) => [k, false])) as Record<PermKey, boolean>;
  preset.forEach((k) => { result[k] = true; });
  return result;
}

// ── PERMISSION DIALOG ───────────────────────────────────────
function PermissionsDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const updateMutation = useUpdateUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [perms, setPerms] = useState<Record<PermKey, boolean>>(() => {
    if (user.permissions) return parsePermissions(user.permissions);
    return permissionsFromRole(user.role);
  });
  const [saving, setSaving] = useState(false);

  const applyPreset = (role: string) => {
    setPerms(permissionsFromRole(role));
  };

  const toggle = (key: PermKey) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: { permissions: JSON.stringify(perms) } as any,
      });
      await queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Permissions saved for " + user.name });
      onClose();
    } catch {
      toast({ title: "Failed to save permissions", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalEnabled = ALL_PERMS.filter((k) => perms[k]).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Permissions — {user.name}
        </DialogTitle>
        <p className="text-xs text-muted-foreground">{user.email} · {totalEnabled} of {ALL_PERMS.length} features enabled</p>
      </DialogHeader>

      {/* Quick presets */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Presets</p>
        <div className="flex gap-2 flex-wrap">
          {(["admin", "accountant", "sales_staff", "view_only"] as const).map((r) => (
            <Button key={r} size="sm" variant="outline" className="h-7 text-xs capitalize" onClick={() => applyPreset(r)}>
              {r.replace("_", " ")}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPerms(Object.fromEntries(ALL_PERMS.map((k) => [k, false])) as any)}>
            Clear All
          </Button>
        </div>
      </div>

      {/* Feature matrix */}
      <div className="max-h-[52vh] overflow-y-auto space-y-4 pr-1">
        {FEATURE_MODULES.map((mod) => (
          <div key={mod.group}>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">{mod.group}</p>
              <div className="flex-1 h-px bg-border" />
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  const allOn = mod.features.every((f) => perms[f.key]);
                  setPerms((prev) => {
                    const next = { ...prev };
                    mod.features.forEach((f) => { next[f.key] = !allOn; });
                    return next;
                  });
                }}
              >
                {mod.features.every((f) => perms[f.key]) ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="space-y-2">
              {mod.features.map((feat) => (
                <label
                  key={feat.key}
                  className="flex items-start gap-3 cursor-pointer group p-2 rounded-md hover:bg-muted/50"
                >
                  <Checkbox
                    checked={perms[feat.key]}
                    onCheckedChange={() => toggle(feat.key)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium leading-none">{feat.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{feat.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Permissions"}
        </Button>
      </DialogFooter>
    </>
  );
}

// ── MAIN PAGE ───────────────────────────────────────────────
export default function UsersSettings() {
  const { user: currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [permUser, setPermUser] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "accountant" });
  const [page, setPage] = useState(1);
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

  const isAdmin = (currentUser as any)?.role === "admin";
  const list = users as any[];
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">{list.length} user{list.length !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Full Name *</Label><Input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Email *</Label><Input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Password *</Label><Input type="password" required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="sales_staff">Sales Staff</SelectItem>
                    <SelectItem value="view_only">View Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create User</Button>
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
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Features</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : paginated.map((u: any) => {
                const permCount = (() => {
                  try {
                    const p = u.permissions ? JSON.parse(u.permissions) : null;
                    if (p) return Object.values(p).filter(Boolean).length;
                  } catch {}
                  return null;
                })();
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {isAdmin && u.id !== (currentUser as any)?.id ? (
                        <Select value={u.role} onValueChange={v => handleRoleChange(u.id, v)}>
                          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="accountant">Accountant</SelectItem>
                            <SelectItem value="sales_staff">Sales Staff</SelectItem>
                            <SelectItem value="view_only">View Only</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`capitalize ${roleColors[u.role] || ""}`}>
                          {u.role?.replace("_", " ")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isAdmin && u.id !== (currentUser as any)?.id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => setPermUser(u)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          {permCount !== null ? `${permCount} features` : "Set Permissions"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {u.role === "admin" ? "All features" : permCount !== null ? `${permCount} features` : "Default"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.id !== (currentUser as any)?.id && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(u.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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

      {/* Permissions dialog */}
      <Dialog open={!!permUser} onOpenChange={o => { if (!o) setPermUser(null); }}>
        <DialogContent className="max-w-2xl">
          {permUser && (
            <PermissionsDialog user={permUser} onClose={() => setPermUser(null)} />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={o => !o && setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
