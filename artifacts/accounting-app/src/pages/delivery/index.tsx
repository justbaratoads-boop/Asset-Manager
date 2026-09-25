import { useState } from "react";
import {
  useListDeliveries, useCreateDelivery, useUpdateDelivery,
  useListVehicles, useCreateVehicle, useDeleteVehicle,
  useListDrivers, useCreateDriver, useDeleteDriver,
  useListSaleInvoices,
  getListDeliveriesQueryKey, getListVehiclesQueryKey, getListDriversQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, today } from "@/lib/format";
import { Plus, Trash2, Eye, CheckCircle2, Truck, UserRound, FileText, Search, Calendar, Phone, MapPin, Printer, ExternalLink } from "lucide-react";
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

// ── ASSIGN BILL DIALOG (MULTIPLE BILL SELECTION) ──────────────
function AssignBillDialog({ deliveries = [] }: { deliveries?: any[] }) {
  const [open, setOpen] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    driverId: "",
    vehicleId: "",
    date: today(),
    destination: "",
    notes: "",
  });

  const { data: invoicesData } = useListSaleInvoices({ page: 1, limit: 300 } as any);
  const { data: drivers = [] } = useListDrivers({});
  const { data: vehicles = [] } = useListVehicles({});
  const createMutation = useCreateDelivery();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invoices: any[] = (invoicesData as any)?.invoices || invoicesData || [];

  // Filter out bills already assigned to active deliveries
  const pendingInvoices = invoices.filter((inv: any) => 
    inv.status !== "cancelled" && 
    inv.isDeleted !== "true" &&
    !deliveries.some(d => (d.invoiceIds?.includes(inv.id) || d.saleInvoiceId === inv.id) && d.status !== "cancelled")
  );

  const filteredInvoices = pendingInvoices.filter((inv: any) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.partyName?.toLowerCase().includes(q)
    );
  });

  const toggleInvoice = (id: number) => {
    setSelectedInvoiceIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const filteredIds = filteredInvoices.map((inv: any) => inv.id);
    const allSelected = filteredIds.every((id: number) => selectedInvoiceIds.includes(id));
    if (allSelected) {
      setSelectedInvoiceIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedInvoiceIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const selectedInvoices = pendingInvoices.filter((inv: any) => selectedInvoiceIds.includes(inv.id));
  const totalSelectedAmount = selectedInvoices.reduce((sum: number, inv: any) => sum + Number(inv.grandTotal || 0), 0);

  const reset = () => {
    setSelectedInvoiceIds([]);
    setSearchQuery("");
    setForm({ driverId: "", vehicleId: "", date: today(), destination: "", notes: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedInvoiceIds.length === 0) return;
    await createMutation.mutateAsync({
      data: {
        saleInvoiceIds: selectedInvoiceIds,
        saleInvoiceId: selectedInvoiceIds[0],
        driverId: form.driverId ? Number(form.driverId) : undefined,
        vehicleId: form.vehicleId ? Number(form.vehicleId) : undefined,
        date: form.date,
        destination: form.destination,
        totalAmount: totalSelectedAmount,
        notes: form.notes,
      } as any,
    });
    queryClient.invalidateQueries({ queryKey: getListDeliveriesQueryKey() });
    toast({ title: `Delivery challan created for ${selectedInvoiceIds.length} bill(s)` });
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />Assign Bills for Delivery</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Bills for Delivery / Pickup</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Multiple Bill Selection Box */}
          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="font-semibold text-sm">Select Bills ({selectedInvoiceIds.length} selected)</Label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search bill# or party..."
                    className="h-8 pl-7 w-44 text-xs"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                {filteredInvoices.length > 0 && (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={toggleSelectAll}>
                    {filteredInvoices.every((inv: any) => selectedInvoiceIds.includes(inv.id)) ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>
            </div>

            {/* Scrollable Checkbox List */}
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 bg-background space-y-1">
              {filteredInvoices.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No pending bills available</p>
              ) : (
                filteredInvoices.map((inv: any) => {
                  const isChecked = selectedInvoiceIds.includes(inv.id);
                  return (
                    <label
                      key={inv.id}
                      className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                        isChecked ? "bg-primary/10 font-medium border border-primary/20" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleInvoice(inv.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="font-mono text-primary font-semibold">{inv.invoiceNumber}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="truncate max-w-[180px]">{inv.partyName || "Cash Sale"}</span>
                        <span className="text-muted-foreground">· {formatDate(inv.date)}</span>
                      </div>
                      <span className="font-semibold">₹{Number(inv.grandTotal).toLocaleString("en-IN")}</span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Summary Box */}
            {selectedInvoiceIds.length > 0 && (
              <div className="flex items-center justify-between text-xs bg-primary/10 text-primary p-2.5 rounded border border-primary/20 font-medium">
                <span>Selected <strong className="font-bold">{selectedInvoiceIds.length}</strong> bill(s)</span>
                <span>Total Amount: <strong className="font-bold text-sm">₹{totalSelectedAmount.toLocaleString("en-IN")}</strong></span>
              </div>
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
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>

            {/* Destination */}
            <div className="space-y-1">
              <Label>Destination / Delivery Address</Label>
              <Input value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} placeholder="City / address" />
            </div>

            {/* Notes */}
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={createMutation.isPending || selectedInvoiceIds.length === 0}>
            Create Delivery Challan ({selectedInvoiceIds.length} Bill{selectedInvoiceIds.length !== 1 ? "s" : ""})
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// ── DELIVERY DETAIL SIDE TRAY ──────────────────────────────
function DeliveryDetailSheet({
  deliveryId,
  open,
  onOpenChange,
  onMarkDelivered,
}: {
  deliveryId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkDelivered: (id: number) => void;
}) {
  const { data: delivery, isLoading } = useQuery({
    queryKey: ["delivery-detail", deliveryId],
    queryFn: () => customFetch<any>(`/api/deliveries/${deliveryId}`),
    enabled: !!open && !!deliveryId,
  });
  const [, navigate] = useLocation();

  const d = delivery as any;
  const invoices: any[] = d?.invoices || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto p-6">
        {!d ? (
          <div className="py-12 text-center text-muted-foreground">
            {isLoading ? "Loading delivery details..." : "No delivery selected"}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header / Title */}
            <div className="border-b pb-4">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <StatusBadge status={d.status} />
                <span className="text-xs text-muted-foreground font-mono">ID #{d.id}</span>
              </div>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Challan #{d.challanNumber || d.tripNumber}
                  </h2>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>Date: <strong className="text-foreground">{d.date ? formatDate(d.date) : "-"}</strong></span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">₹{Number(d.totalAmount || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Transport & Driver Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Driver info */}
              <div className="bg-muted/40 border rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <UserRound className="h-4 w-4 text-primary" /> Driver
                </div>
                {d.driverName ? (
                  <div>
                    <div className="font-medium text-base">{d.driverName}</div>
                    {d.driverPhone && (
                      <a href={`tel:${d.driverPhone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" /> {d.driverPhone}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No driver assigned</p>
                )}
              </div>

              {/* Vehicle info */}
              <div className="bg-muted/40 border rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Truck className="h-4 w-4 text-primary" /> Vehicle
                </div>
                {d.vehicleNumber ? (
                  <div>
                    <div className="font-mono font-medium text-base">{d.vehicleNumber}</div>
                    {d.vehicleType && <div className="text-xs text-muted-foreground capitalize">{d.vehicleType}</div>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No vehicle assigned</p>
                )}
              </div>
            </div>

            {/* Destination & Notes */}
            {(d.destination || d.notes) && (
              <div className="bg-muted/20 border rounded-lg p-3.5 space-y-2 text-sm">
                {d.destination && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">Destination / Delivery Address</span>
                      <span className="font-medium">{d.destination}</span>
                    </div>
                  </div>
                )}
                {d.notes && (
                  <div className="pt-2 border-t text-xs">
                    <span className="font-semibold text-muted-foreground block">Notes</span>
                    <p className="italic text-slate-700">{d.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Assigned Bills / Sales Invoices with all item entries */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Assigned Bills
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {invoices.length} {invoices.length === 1 ? "Bill" : "Bills"}
                  </Badge>
                </h3>
                <span className="text-xs text-muted-foreground">
                  All entries and items shown below
                </span>
              </div>

              {invoices.length === 0 ? (
                <div className="border rounded-lg p-6 text-center text-muted-foreground text-sm">
                  {d.invoiceNumber ? (
                    <div>
                      <p>Attached Invoice: <strong className="font-mono text-foreground">{d.invoiceNumber}</strong></p>
                      <p className="text-xs mt-1">Party: {d.partyName || "-"}</p>
                    </div>
                  ) : (
                    "No bills attached to this delivery"
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {invoices.map((inv: any, idx: number) => {
                    const items: any[] = inv.items || [];
                    return (
                      <div key={inv.id || idx} className="border rounded-lg bg-card overflow-hidden shadow-sm">
                        {/* Bill Card Header */}
                        <div className="bg-muted/50 p-3.5 border-b flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-primary">
                                {inv.invoiceNumber}
                              </span>
                              {inv.date && (
                                <span className="text-xs text-muted-foreground">
                                  ({formatDate(inv.date)})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <UserRound className="h-3 w-3" />
                              <strong className="text-foreground">{inv.partyName || "-"}</strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground block">Bill Total</span>
                              <span className="font-bold text-sm text-primary">
                                ₹{Number(inv.grandTotal || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs"
                              onClick={() => {
                                onOpenChange(false);
                                navigate(`/sales/invoices/${inv.id}`);
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open Bill
                            </Button>
                          </div>
                        </div>

                        {/* Items Table for this Bill */}
                        <div className="p-0 overflow-x-auto">
                          {items.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-3 italic">
                              No items listed in invoice
                            </p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/20 text-xs">
                                  <TableHead className="w-8">#</TableHead>
                                  <TableHead>Item Name</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Rate</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((it: any, itemIdx: number) => (
                                  <TableRow key={it.id || itemIdx} className="text-xs">
                                    <TableCell className="text-muted-foreground">{itemIdx + 1}</TableCell>
                                    <TableCell className="font-medium">{it.itemName}</TableCell>
                                    <TableCell className="text-right font-mono">
                                      {it.quantity} {it.unit || ""}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      ₹{Number(it.rate || 0).toLocaleString("en-IN")}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      ₹{Number(it.total || 0).toLocaleString("en-IN")}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="border-t pt-4 flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-1.5" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print Challan
                </Button>
                {d.status !== "delivered" && (
                  <Button
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      onOpenChange(false);
                      onMarkDelivered(d.id);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark as Delivered
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── DELIVERIES TAB ─────────────────────────────────────────
function DeliveriesTab() {
  const [completeId, setCompleteId] = useState<number | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);
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
          <p className="text-sm">No deliveries yet. Assign bills to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Challan#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Bill(s)#</TableHead>
                <TableHead>Party</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((d: any) => {
                const invoiceList = d.invoices && d.invoices.length > 0 ? d.invoices : (d.saleInvoiceId ? [{ id: d.saleInvoiceId, invoiceNumber: d.invoiceNumber, partyName: d.partyName, grandTotal: d.totalAmount }] : []);
                return (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedDeliveryId(d.id)}>
                    <TableCell className="font-mono text-sm font-medium">{d.challanNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.date ? formatDate(d.date) : "-"}</TableCell>
                    <TableCell className="text-sm">
                      {invoiceList.length > 1 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-xs font-semibold px-1.5 py-0.5 bg-blue-100 text-blue-700">
                              {invoiceList.length} Bills
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {invoiceList.map((inv: any) => (
                              <Badge
                                key={inv.id}
                                variant="outline"
                                className="cursor-pointer hover:bg-muted text-[11px] font-mono"
                                onClick={() => navigate(`/sales/invoices/${inv.id}`)}
                                title={`Click to view ${inv.invoiceNumber}`}
                              >
                                {inv.invoiceNumber}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : invoiceList.length === 1 ? (
                        <span
                          className="font-mono text-sm text-primary cursor-pointer hover:underline"
                          onClick={() => navigate(`/sales/invoices/${invoiceList[0].id}`)}
                        >
                          {invoiceList[0].invoiceNumber || d.invoiceNumber || "-"}
                        </span>
                      ) : (
                        <span className="text-sm">{d.invoiceNumber || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-sm">{d.partyName || "-"}</TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      ₹{Number(d.totalAmount || 0).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{d.destination || "-"}</TableCell>
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
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-primary"
                          title="View Delivery Details & Bills"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDeliveryId(d.id);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {d.status !== "delivered" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600"
                            title="Mark Delivered"
                            onClick={(e) => { e.stopPropagation(); setCompleteId(d.id); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
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

      {/* Delivery Side Tray */}
      <DeliveryDetailSheet
        deliveryId={selectedDeliveryId}
        open={!!selectedDeliveryId}
        onOpenChange={v => !v && setSelectedDeliveryId(null)}
        onMarkDelivered={id => setCompleteId(id)}
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
