import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Upload, Database, FileSpreadsheet, HardDriveDownload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useLocation } from "wouter";

export default function Utilities() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Parse path to determine active tab
  const activeTab = location.includes("import") ? "import" 
                  : location.includes("backup") ? "backup" 
                  : "export";

  const handleTabChange = (val: string) => {
    setLocation(`/utility/${val}`);
  };

  const handleExport = (type: string) => {
    toast({
      title: "Export Started",
      description: `Your ${type} data is being exported to Excel.`,
    });
    // Simulated export delay
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: `${type} data exported successfully.`,
        variant: "default",
      });
    }, 1500);
  };

  const handleImport = (e: React.FormEvent, type: string) => {
    e.preventDefault();
    toast({
      title: "Importing Data",
      description: `Please wait while we process your ${type} data.`,
    });
    setTimeout(() => {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${type} data.`,
        variant: "default",
      });
    }, 2000);
  };

  const handleBackup = () => {
    toast({
      title: "Generating Backup",
      description: "Creating a full database backup. This may take a moment...",
    });
    setTimeout(() => {
      toast({
        title: "Backup Ready",
        description: "Your backup file (backup.json) has been downloaded.",
      });
    }, 3000);
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <WrenchIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Utilities</h1>
          <p className="text-muted-foreground mt-1">
            Export data, import bulk records, and manage backups.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Export
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Backup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Export Items
                </CardTitle>
                <CardDescription>Download all your stock items and current inventory levels to an Excel file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => handleExport("Items")} className="w-full">
                  Export Items to Excel
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Export Parties
                </CardTitle>
                <CardDescription>Download all your customer and supplier ledger details to an Excel file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => handleExport("Parties")} className="w-full">
                  Export Parties to Excel
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Export Sales
                </CardTitle>
                <CardDescription>Download all sales invoices for the current financial year to an Excel file.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => handleExport("Sales Invoices")} className="w-full">
                  Export Sales to Excel
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Bulk Import Items
                </CardTitle>
                <CardDescription>Upload an Excel or CSV file to create multiple stock items at once.</CardDescription>
              </CardHeader>
              <form onSubmit={(e) => handleImport(e, "Items")}>
                <CardContent>
                  <input type="file" accept=".csv, .xlsx, .xls" required className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                  <div className="mt-4 flex gap-2">
                    <Button variant="link" className="p-0 h-auto text-xs" type="button">Download Template</Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">Upload & Process</Button>
                </CardFooter>
              </form>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Bulk Import Parties
                </CardTitle>
                <CardDescription>Upload an Excel or CSV file to create multiple customer/supplier ledgers.</CardDescription>
              </CardHeader>
              <form onSubmit={(e) => handleImport(e, "Parties")}>
                <CardContent>
                  <input type="file" accept=".csv, .xlsx, .xls" required className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                  <div className="mt-4 flex gap-2">
                    <Button variant="link" className="p-0 h-auto text-xs" type="button">Download Template</Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">Upload & Process</Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="backup" className="space-y-4">
          <Card className="max-w-2xl border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDriveDownload className="h-5 w-5 text-primary" />
                Full Database Backup
              </CardTitle>
              <CardDescription>
                Generate a complete snapshot of all your company data including settings, invoices, items, and users.
                Keep this file secure as it contains sensitive financial information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-md">
                <h4 className="font-semibold text-sm mb-2">What is included?</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>All Ledgers, Account Groups & Parties</li>
                  <li>Stock Items, Categories & Batches</li>
                  <li>All Vouchers (Sales, Purchase, Payments, Receipts, Journals, etc.)</li>
                  <li>Company Settings and Print Formats</li>
                  <li>Users & Roles</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button size="lg" onClick={handleBackup} className="w-full font-semibold">
                <Download className="mr-2 h-4 w-4" /> Generate Full Backup
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WrenchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
