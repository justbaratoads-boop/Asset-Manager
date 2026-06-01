import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Truck, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DriversAndVehicles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [driverOpen, setDriverOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);

  // Queries
  const { data: drivers = [], isLoading: isLoadingDrivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: () => customFetch("/api/delivery/drivers")
  });

  const { data: vehicles = [], isLoading: isLoadingVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => customFetch("/api/delivery/vehicles")
  });

  // Mutations
  const createDriver = useMutation({
    mutationFn: (data: any) => customFetch("/api/delivery/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setDriverOpen(false);
      toast({ title: "Driver added successfully" });
    }
  });

  const deleteDriver = useMutation({
    mutationFn: (id: number) => customFetch(`/api/delivery/drivers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast({ title: "Driver deleted" });
    }
  });

  const createVehicle = useMutation({
    mutationFn: (data: any) => customFetch("/api/delivery/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setVehicleOpen(false);
      toast({ title: "Vehicle added successfully" });
    }
  });

  const deleteVehicle = useMutation({
    mutationFn: (id: number) => customFetch(`/api/delivery/vehicles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      toast({ title: "Vehicle deleted" });
    }
  });

  // Forms
  const handleDriverSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createDriver.mutate({
      name: fd.get("name"),
      phone: fd.get("phone"),
      licenseNumber: fd.get("licenseNumber"),
    });
  };

  const handleVehicleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createVehicle.mutate({
      vehicleNumber: fd.get("vehicleNumber"),
      type: fd.get("type"),
      ownerName: fd.get("ownerName"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Delivery Fleet</h1>
      </div>

      <Tabs defaultValue="drivers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="drivers" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Drivers
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-2">
            <Truck className="h-4 w-4" /> Vehicles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drivers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Drivers List</CardTitle>
              <Dialog open={driverOpen} onOpenChange={setDriverOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Driver</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Driver</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleDriverSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input id="name" name="name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" name="phone" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="licenseNumber">License Number</Label>
                      <Input id="licenseNumber" name="licenseNumber" />
                    </div>
                    <Button type="submit" className="w-full" disabled={createDriver.isPending}>
                      {createDriver.isPending ? "Saving..." : "Save Driver"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>License No.</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingDrivers ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : (drivers as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No drivers found.</TableCell></TableRow>
                  ) : (
                    (drivers as any[]).map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>{d.phone || "-"}</TableCell>
                        <TableCell>{d.licenseNumber || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => {
                            if(confirm("Are you sure you want to delete this driver?")) deleteDriver.mutate(d.id);
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Vehicles List</CardTitle>
              <Dialog open={vehicleOpen} onOpenChange={setVehicleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Vehicle</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Vehicle</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleVehicleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicleNumber">Registration Number *</Label>
                      <Input id="vehicleNumber" name="vehicleNumber" placeholder="e.g. MH 01 AB 1234" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Vehicle Type</Label>
                      <Input id="type" name="type" placeholder="e.g. Mini Truck, Van" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ownerName">Owner Name (if third-party)</Label>
                      <Input id="ownerName" name="ownerName" />
                    </div>
                    <Button type="submit" className="w-full" disabled={createVehicle.isPending}>
                      {createVehicle.isPending ? "Saving..." : "Save Vehicle"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reg. Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingVehicles ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : (vehicles as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No vehicles found.</TableCell></TableRow>
                  ) : (
                    (vehicles as any[]).map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium uppercase">{v.vehicleNumber}</TableCell>
                        <TableCell>{v.type || "-"}</TableCell>
                        <TableCell>{v.ownerName || "Owned"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => {
                            if(confirm("Are you sure you want to delete this vehicle?")) deleteVehicle.mutate(v.id);
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
