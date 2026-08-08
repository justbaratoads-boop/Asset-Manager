import { useState } from "react";
import {
  useListDeliveries, useCreateDelivery, useUpdateDelivery,
  useListVehicles, useCreateVehicle, useDeleteVehicle,
  useListDrivers, useCreateDriver, useDeleteDriver,
  useListSaleInvoices,
  getListDeliveriesQueryKey, getListVehiclesQueryKey, getListDriversQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, today } from "@/lib/format";
import { Plus, Trash2, Eye, CheckCircle2, Truck, UserRound, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useLocation } from "wouter";

// ── STATUS BADGE ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
    in_transit: "bg-blue-100 text-blue-700 border-blue-300",
    delivered: "bg-green-100 text-green-700 border-green-300",
    cancelled: "bg-red-100 text-red-700 border-red-300",
  };
  const label: Record<string, string> = {
    pending: "Pending",
    in_transit: "In Transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return (
    <Badge variant="outline" className={`capitalize text-xs ${map[status] || ""}`}>
      {label[status] || status}
    </Badge>
  );
}

// ── ASSIGN BILL DIALOG ─────────────────────────────────────
function AssignBillDialog({ deliveries = [] }: { deliveries?: any[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    saleInvoiceId: "",
    driverId: "",
    vehicleId: "",
    date: today(),
    destination: "",
    notes: "",
  });
  const { data: invoicesData } = useListSaleInvoices({ page: 1, limit: 200 } as any);
  const { data: drivers = [] } = useListDrivers({});
  const { data: vehicles = [] } = useListVehicles({});
  const createMutation = useCreateDelivery();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invoices: any[] = (invoicesData as any)?.invoices || invoicesData || [];
  const pendingInvoices = invoices.filter((inv: any) => 
    inv.status !== "cancelled" && 
    inv.isDeleted !== "true" &&
    !deliveries.some(d => d.saleInvoiceId === inv.id && d.status !== "cancelled")
  );

  const reset = () => setForm({ saleInvoiceId: "", driverId: "", vehicleId: "", date: today(), destination: "", notes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.saleInvoiceId) return;
    await createMutation.mutateAsync({
      data: {
        saleInvoiceId: Number(form.saleInvoiceId),
        driverId: form.driverId ? Number(form.driverId) : undefined,
        vehicleId: form.vehicleId ? Number(form.vehicleId) : undefined,
        date: form.date,
        destination: form.destination,
        notes: form.notes,
      } as any,
    });
    queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
    toast({ title: "Delivery challan created" });
    setOpen(false);
    reset();
  };

  const selectedInv = pendingInvoices.find((i: any) => String(i.id) === form.saleInvoiceId);

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />Assign Bill</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Assign Bill for Delivery</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bill selection */}
          <div className="space-y-1">
            <Label>Select Bill *</Label>
            <Select value={form.saleInvoiceId} onValueChange={v => setForm(p => ({ ...p, saleInvoiceId: v }))}>
              <SelectTrigger><SelectValue placeholder="Choose invoice..." /></SelectTrigger>
              <SelectContent>
                {pendingInvoices.map((inv: any) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>
                    {inv.invoiceNumber} — {inv.partyName || "Cash"} (₹{Number(inv.grandTotal).toFixed(0)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedInv && (
              <p className="text-xs text-muted-foreground mt-1">
                Party: <span className="font-medium">{selectedInv.partyName || "Cash"}</span> · Date: {formatDate(selectedInv.date)} · Amount: ₹{Number(selectedInv.grandTotal).toLocaleString("en-IN")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Driver */}
            <div className="space-y-1">
              <Label>Driver</Label>
              <Select value={form.driverId} onValueChange={v => setForm(p => ({ ...p, driverId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                <SelectContent>
                  {(drivers as any[]).map((d: any) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}{d.phone ? ` · ${d.phone}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle */}
            <div className="space-y-1">
              <Label>Vehicle</Label>
              <Select value={form.vehicleId} onValueChange={v => setForm(p => ({ ...p, vehicleId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  {(vehicles as any[]).map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.vehicleNumber}{v.type ? ` (${v.type})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1">
              <Label>Dispatch Date</Label>
              <Input type="date" min={selectedInv?.date || ""} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>

            {/* Destination */}
            <div className="space-y-1">
              <Label>Destination</Label>
              <Input value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} placeholder="City / address" />
            </div>

            {/* Notes */}
            <div className="space-y-1 col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={createMutation.isPending || !form.saleInvoiceId}>
            Create Delivery Challan
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── DELIVERIES TAB ─────────────────────────────────────────
function DeliveriesTab() {
  const [completeId, setCompleteId] = useState<number | null>(null);
  const { data: deliveries = [], isLoading } = useListDeliveries({});
  const updateMutation = useUpdateDelivery();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleComplete = async () => {
    if (!completeId) return;
    await updateMutation.mutateAsync({ id: completeId, data: { status: "delivered" } as any });
    queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
    setCompleteId(null);
    toast({ title: "Delivery marked as completed" });
  };

  const list = (deliveries as any[]).filter(d => d.status !== "cancelled");

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">Delivery Challans</h2>
        <AssignBillDialog deliveries={list} />
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Loading...</p>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No deliveries yet. Assign a bill to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Challan#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Bill#</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm font-medium">{d.challanNumber}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.date ? formatDate(d.date) : "-"}</TableCell>
                  <TableCell className="text-sm">{d.invoiceNumber || "-"}</TableCell>
                  <TableCell className="max-w-[120px] truncate text-sm">{d.partyName || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.destination || "-"}</TableCell>
                  <TableCell className="text-sm">
                    {d.driverName ? (
                      <div>
                        <div className="font-medium">{d.driverName}</div>
                        {d.driverPhone && <div className="text-xs text-muted-foreground">{d.driverPhone}</div>}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.vehicleNumber ? (
                      <div>
                        <div className="font-medium">{d.vehicleNumber}</div>
                        {d.vehicleType && <div className="text-xs text-muted-foreground">{d.vehicleType}</div>}
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {d.saleInvoiceId && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-blue-600"
                          title="View Invoice"
                          onClick={() => navigate(`/sales/invoices/${d.saleInvoiceId}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {d.status !== "delivered" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-green-600"
                          title="Mark Delivered"
                          onClick={() => setCompleteId(d.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={!!completeId}
        onOpenChange={o => !o && setCompleteId(null)}
        onConfirm={handleComplete}
        loading={updateMutation.isPending}
        title="Mark as Delivered?"
        description="This will mark the delivery as completed. This action cannot be undone."
        confirmLabel="Complete Delivery"
      />
    </>
  );
}

// ── DRIVERS TAB ────────────────────────────────────────────
function DriversTab() {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", licenseNumber: "", notes: "" });
  const { data: drivers = [], isLoading } = useListDrivers({});
  const createMutation = useCreateDriver();
  const deleteMutation = useDeleteDriver();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reset = () => setForm({ name: "", phone: "", licenseNumber: "", notes: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ data: form as any });
    queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
    toast({ title: "Driver added" });
    setOpen(false);
    reset();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
    setDeleteId(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">Drivers</h2>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />Add Driver</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Driver</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Name *</Label>
                  <Input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit mobile" />
                </div>
                <div className="space-y-1">
                  <Label>License Number</Label>
                  <Input value={form.licenseNumber} onChange={e => setForm(p => ({ ...p, licenseNumber: e.target.value }))} placeholder="DL-XXXXXXXXXX" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Add Driver</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Loading...</p>
      ) : (drivers as any[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserRound className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No drivers added yet.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>License No.</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(drivers as any[]).map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-sm">{d.phone || "-"}</TableCell>
                <TableCell className="text-sm font-mono">{d.licenseNumber || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.notes || "-"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </>
  );
}

// ── VEHICLES TAB ───────────────────────────────────────────
function VehiclesTab() {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ vehicleNumber: "", type: "", ownerName: "", driverName: "", driverPhone: "" });
  const { data: vehicles = [], isLoading } = useListVehicles({});
  const createMutation = useCreateVehicle();
  const deleteMutation = useDeleteVehicle();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reset = () => setForm({ vehicleNumber: "", type: "", ownerName: "", driverName: "", driverPhone: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ data: form as any });
    queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
    toast({ title: "Vehicle added" });
    setOpen(false);
    reset();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync({ id: deleteId });
    queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
    setDeleteId(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">Vehicles</h2>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />Add Vehicle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Vehicle Number *</Label>
                  <Input required value={form.vehicleNumber} onChange={e => setForm(p => ({ ...p, vehicleNumber: e.target.value }))} placeholder="MH-12 AB 1234" />
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Input value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} placeholder="Truck / Tempo..." />
                </div>
                <div className="space-y-1">
                  <Label>Owner Name</Label>
                  <Input value={form.ownerName} onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Default Driver</Label>
                  <Input value={form.driverName} onChange={e => setForm(p => ({ ...p, driverName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Driver Phone</Label>
                  <Input value={form.driverPhone} onChange={e => setForm(p => ({ ...p, driverPhone: e.target.value }))} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Add Vehicle</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground text-sm">Loading...</p>
      ) : (vehicles as any[]).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No vehicles added yet.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Default Driver</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(vehicles as any[]).map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium font-mono">{v.vehicleNumber}</TableCell>
                <TableCell className="text-sm">{v.type || "-"}</TableCell>
                <TableCell className="text-sm">{v.ownerName || "-"}</TableCell>
                <TableCell className="text-sm">{v.driverName || "-"}</TableCell>
                <TableCell className="text-sm">{v.driverPhone || "-"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </>
  );
}

// ── PAGE ───────────────────────────────────────────────────
export default function DeliveryPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Delivery & Logistics</h1>
      </div>
      <Tabs defaultValue="deliveries">
        <TabsList>
          <TabsTrigger value="deliveries" className="gap-1.5"><Truck className="h-3.5 w-3.5" />Challans</TabsTrigger>
          <TabsTrigger value="drivers" className="gap-1.5"><UserRound className="h-3.5 w-3.5" />Drivers</TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-1.5"><Truck className="h-3.5 w-3.5" />Vehicles</TabsTrigger>
        </TabsList>
        <TabsContent value="deliveries">
          <Card><CardContent className="p-4"><DeliveriesTab /></CardContent></Card>
        </TabsContent>
        <TabsContent value="drivers">
          <Card><CardContent className="p-4"><DriversTab /></CardContent></Card>
        </TabsContent>
        <TabsContent value="vehicles">
          <Card><CardContent className="p-4"><VehiclesTab /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
