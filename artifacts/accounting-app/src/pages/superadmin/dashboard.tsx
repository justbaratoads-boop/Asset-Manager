import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (user?.role !== "superadmin") {
    setLocation("/");
    return null;
  }

  const { data: businesses, isLoading } = useQuery({
    queryKey: ["/api/superadmin/businesses"],
  });

  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const createBusiness = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/superadmin/businesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Business created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/businesses"] });
      setName("");
      setAdminEmail("");
      setAdminPassword("");
    },
    onError: (err: Error) => {
      toast({ title: "Error creating business", description: err.message, variant: "destructive" });
    }
  });

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Superadmin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Business</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => {
              e.preventDefault();
              createBusiness.mutate({ name, adminEmail, adminPassword });
            }} className="space-y-4">
              <div>
                <Label>Business Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Admin Email</Label>
                <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required />
              </div>
              <div>
                <Label>Admin Password</Label>
                <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={createBusiness.isPending}>
                {createBusiness.isPending ? "Creating..." : "Create Business"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Businesses</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Admin Email</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses?.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.id}</TableCell>
                      <TableCell>{b.name}</TableCell>
                      <TableCell>{b.adminEmail}</TableCell>
                      <TableCell>{new Date(b.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
