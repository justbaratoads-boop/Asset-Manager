import { useState } from "react";
import { useListDeliveries, useCreateDelivery, useUpdateDelivery, useListVehicles, useCreateVehicle, useDeleteVehicle, getListDeliveriesQueryKey, getListVehiclesQueryKey } from "@workspace/api-client-react";
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
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";

function Vehicles() {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ vehicleNumber: "", type: "", ownerName: "", driverName: "", driverPhone: "" });
  const { data: vehicles = [], isLoading } = useListVehicles({});
  const createMutation = useCreateVehicle();
  const deleteMutation = useDeleteVehicle();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ data: form as any });
    queryClient.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
    setOpen(false);
    toast({ title: "Vehicle added" });
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
        <h2 className="font-semibold">Vehicles</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />Add Vehicle</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Vehicle Number *</Label><Input required value={form.vehicleNumber} onChange={e => setForm(p => ({ ...p, vehicleNumber: e.target.value }))} placeholder="MH-12 AB 1234" /></div>
                <div className="space-y-1"><Label>Type</Label><Input value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} placeholder="Truck / Tempo..." /></div>
                <div className="space-y-1"><Label>Owner</Label><Input value={form.ownerName} onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Driver</Label><Input value={form.driverName} onChange={e => setForm(p => ({ ...p, driverName: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Driver Phone</Label><Input value={form.driverPhone} onChange={e => setForm(p => ({ ...p, driverPhone: e.target.value }))} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Add Vehicle</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Vehicle#</TableHead><TableHead>Type</TableHead><TableHead>Owner</TableHead><TableHead>Driver</TableHead><TableHead>Phone</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            : (vehicles as any[]).length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No vehicles</TableCell></TableRow>
              : (vehicles as any[]).map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.vehicleNumber}</TableCell>
                  <TableCell className="text-sm">{v.type}</TableCell>
                  <TableCell className="text-sm">{v.ownerName}</TableCell>
                  <TableCell className="text-sm">{v.driverName}</TableCell>
                  <TableCell className="text-sm">{v.driverPhone}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={deleteMutation.isPending} />
    </>
  );
}

function Deliveries() {
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ date: today(), vehicleId: "", invoiceNumber: "", partyName: "", destination: "", notes: "" });
  const { data: deliveries = [], isLoading } = useListDeliveries({});
  const { data: vehicles = [] } = useListVehicles({});
  const createMutation = useCreateDelivery();
  const updateMutation = useUpdateDelivery();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ data: { ...form, vehicleId: Number(form.vehicleId) } as any });
    queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
    setOpen(false);
    toast({ title: "Delivery challan created" });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await updateMutation.mutateAsync({ id: deleteId, data: { status: "cancelled" } as any });
    queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
    setDeleteId(null);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Delivery Challans</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />New Challan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Delivery Challan</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Invoice#</Label><Input value={form.invoiceNumber} onChange={e => setForm(p => ({ ...p, invoiceNumber: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Party</Label><Input value={form.partyName} onChange={e => setForm(p => ({ ...p, partyName: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Destination</Label><Input value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} /></div>
                <div className="space-y-1 col-span-2"><Label>Vehicle</Label><Select value={form.vehicleId} onValueChange={v => setForm(p => ({ ...p, vehicleId: v }))}><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger><SelectContent>{(vehicles as any[]).map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.vehicleNumber} - {v.driverName}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1 col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Create Challan</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Challan#</TableHead><TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead>Destination</TableHead><TableHead>Vehicle</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {isLoading ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
            : (deliveries as any[]).length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No deliveries</TableCell></TableRow>
              : (deliveries as any[]).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.challanNumber}</TableCell>
                  <TableCell className="text-sm">{formatDate(d.date)}</TableCell>
                  <TableCell>{d.partyName}</TableCell>
                  <TableCell className="text-sm">{d.destination}</TableCell>
                  <TableCell className="text-sm">{d.vehicleNumber}</TableCell>
                  <TableCell><Badge variant="outline" className={`capitalize text-xs ${d.status === "delivered" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{d.status}</Badge></TableCell>
                  <TableCell><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
      <ConfirmDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} onConfirm={handleDelete} loading={updateMutation.isPending} />
    </>
  );
}

export default function DeliveryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Delivery & Logistics</h1>
      <Tabs defaultValue="deliveries">
        <TabsList><TabsTrigger value="deliveries">Challans</TabsTrigger><TabsTrigger value="vehicles">Vehicles</TabsTrigger></TabsList>
        <TabsContent value="deliveries"><Card><CardContent className="p-4"><Deliveries /></CardContent></Card></TabsContent>
        <TabsContent value="vehicles"><Card><CardContent className="p-4"><Vehicles /></CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
