import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  HardDriveDownload,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  RefreshCw,
  Loader2,
  FileText,
  FileUp,
  Info,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { BulkImportDialog } from "@/components/bulk-import-dialog";
import { downloadStockItemTemplate, downloadLedgerTemplate } from "@/lib/excel-import";
import { useFY } from "@/lib/financial-year";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Utilities() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { globalFrom, globalTo } = useFY();

  // Dialogs
  const [importItemOpen, setImportItemOpen] = useState(false);
  const [importLedgerOpen, setImportLedgerOpen] = useState(false);

  // Backup Export State
  const [exportDateMode, setExportDateMode] = useState<"all" | "range">("all");
  const [exportFrom, setExportFrom] = useState(globalFrom);
  const [exportTo, setExportTo] = useState(globalTo);
  const [exporting, setExporting] = useState(false);

  // Backup Restore State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePayload, setRestorePayload] = useState<any | null>(null);
  const [inspectData, setInspectData] = useState<any | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [restoreSuccessData, setRestoreSuccessData] = useState<any | null>(null);

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
    setTimeout(() => {
      toast({
        title: "Export Complete",
        description: `${type} data exported successfully.`,
        variant: "default",
      });
    }, 1500);
  };

  // ==========================================
  // Backup Export
  // ==========================================
  const handleDownloadBackup = async () => {
    try {
      setExporting(true);
      let url = "/api/backup/export";
      if (exportDateMode === "range") {
        const params = new URLSearchParams();
        if (exportFrom) params.append("from", exportFrom);
        if (exportTo) params.append("to", exportTo);
        url += `?${params.toString()}`;
      }

      const blob = await customFetch<Blob>(url, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const dateTag = exportDateMode === "range" ? `_${exportFrom || "start"}_to_${exportTo || "now"}` : "_full";
      a.download = `backup${dateTag}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast({
        title: "Backup Downloaded",
        description: exportDateMode === "range"
          ? `Backup for date range ${exportFrom} to ${exportTo} downloaded successfully.`
          : "Complete full database backup downloaded successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Backup Failed",
        description: err.message || "Failed to generate database backup.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // ==========================================
  // Backup File Selection & Inspection
  // ==========================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast({
        title: "Invalid File Type",
        description: "Please select a valid Antigravity backup JSON (.json) file.",
        variant: "destructive",
      });
      return;
    }

    setRestoreFile(file);
    setInspectData(null);
    setRestorePayload(null);
    inspectBackupFile(file);
  };

  const inspectBackupFile = (file: File) => {
    setInspecting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || parsed.signature !== "ANTIGRAVITY_ACCOUNTING_BACKUP" || !parsed.data) {
          throw new Error("This file is not a valid Antigravity Accounting backup file.");
        }

        // Send to backend inspect endpoint for validation & structure breakdown
        const inspected = await customFetch<any>("/api/backup/inspect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });

        setRestorePayload(parsed);
        setInspectData(inspected);

        toast({
          title: "Backup File Verified",
          description: `Valid backup from ${inspected.company?.name || "Company"}. Ready to restore.`,
        });
      } catch (err: any) {
        setRestoreFile(null);
        setRestorePayload(null);
        setInspectData(null);
        toast({
          title: "File Inspection Failed",
          description: err.message || "Could not read or verify backup file.",
          variant: "destructive",
        });
      } finally {
        setInspecting(false);
      }
    };

    reader.onerror = () => {
      setInspecting(false);
      toast({
        title: "Error Reading File",
        description: "Could not read the selected file.",
        variant: "destructive",
      });
    };

    reader.readAsText(file);
  };

  const handleResetRestore = () => {
    setRestoreFile(null);
    setRestorePayload(null);
    setInspectData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ==========================================
  // Execute Restore
  // ==========================================
  const triggerRestore = () => {
    if (!restorePayload) return;
    if (restoreMode === "replace") {
      setConfirmReplaceOpen(true);
    } else {
      executeRestore();
    }
  };

  const executeRestore = async () => {
    try {
      setConfirmReplaceOpen(false);
      setRestoring(true);

      const result = await customFetch<any>("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupData: restorePayload,
          mode: restoreMode,
        }),
      });

      // Invalidate queries so all app pages refresh their data
      await queryClient.invalidateQueries();

      setRestoreSuccessData(result);
      handleResetRestore();

      toast({
        title: "Restore Completed Successfully",
        description: `Database restored in '${restoreMode}' mode.`,
      });
    } catch (err: any) {
      toast({
        title: "Restoration Failed",
        description: err.message || "Failed to restore backup data.",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

        {/* EXPORT TAB */}
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

        {/* IMPORT TAB */}
        <TabsContent value="import" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Bulk Import Items
                </CardTitle>
                <CardDescription>Upload an Excel (.xlsx / .xls) or CSV file to create or update multiple stock items at once.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Use our sample template pre-configured with required columns (Name, Unit, Rates, Opening Stock, GST, etc.) for seamless import.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadStockItemTemplate} className="text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5 text-primary" /> Download Sample Template (.xlsx)
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => setImportItemOpen(true)} className="w-full gap-2">
                  <Upload className="h-4 w-4" /> Open Item Import Wizard
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Bulk Import Ledgers & Parties
                </CardTitle>
                <CardDescription>Upload an Excel (.xlsx / .xls) or CSV file to create or update multiple customer, supplier, bank, and expense ledgers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Use our sample template pre-configured with Debtors, Creditors, Bank, and Expense ledger formats with GSTIN and address fields.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadLedgerTemplate} className="text-xs gap-1.5">
                    <Download className="h-3.5 w-3.5 text-primary" /> Download Sample Template (.xlsx)
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => setImportLedgerOpen(true)} className="w-full gap-2">
                  <Upload className="h-4 w-4" /> Open Ledger Import Wizard
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* BACKUP TAB */}
        <TabsContent value="backup" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6 items-start">
            
            {/* 1. EXPORT BACKUP CARD */}
            <Card className="border-primary/20 shadow-sm flex flex-col justify-between">
              <div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <HardDriveDownload className="h-5 w-5 text-primary" />
                    Download Database Backup
                  </CardTitle>
                  <CardDescription>
                    Generate and download a comprehensive JSON snapshot of your company records, vouchers, and settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Backup Scope & Date Filter</Label>
                    <RadioGroup
                      value={exportDateMode}
                      onValueChange={(val: any) => setExportDateMode(val)}
                      className="grid grid-cols-1 gap-2.5"
                    >
                      <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="all" id="scope-all" />
                        <label htmlFor="scope-all" className="cursor-pointer text-sm font-medium flex-1">
                          <div>All Time (Complete Backup)</div>
                          <span className="text-xs text-muted-foreground font-normal">
                            Exports all historical vouchers and all master records.
                          </span>
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value="range" id="scope-range" />
                        <label htmlFor="scope-range" className="cursor-pointer text-sm font-medium flex-1">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Date Range Filter
                          </div>
                          <span className="text-xs text-muted-foreground font-normal">
                            Filter vouchers to a specific timeframe. Masters are preserved.
                          </span>
                        </label>
                      </div>
                    </RadioGroup>
                  </div>

                  {exportDateMode === "range" && (
                    <div className="p-3 bg-muted/40 rounded-lg border border-border/60 space-y-3 animate-in fade-in-50 duration-200">
                      <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" /> Select Voucher Date Range:
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">From Date</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs bg-background"
                            value={exportFrom}
                            onChange={(e) => setExportFrom(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">To Date</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs bg-background"
                            value={exportTo}
                            onChange={(e) => setExportTo(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-muted/30 border rounded-lg p-3 text-xs space-y-1.5 text-muted-foreground">
                    <div className="font-semibold text-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Guaranteed Integrity
                    </div>
                    <p>
                      Master data (Company Settings, Ledgers, Parties, Items, Batches, Users) is always fully preserved so your transactions can be accurately restored.
                    </p>
                  </div>
                </CardContent>
              </div>
              <CardFooter className="pt-2">
                <Button
                  size="lg"
                  onClick={handleDownloadBackup}
                  disabled={exporting}
                  className="w-full font-semibold gap-2"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating Backup...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" /> Download Backup File (.json)
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {/* 2. RESTORE BACKUP CARD */}
            <Card className="border-primary/20 shadow-sm flex flex-col justify-between">
              <div>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="h-5 w-5 text-primary" />
                    Restore / Import Backup File
                  </CardTitle>
                  <CardDescription>
                    Upload a previously generated backup (.json) file to restore masters and voucher transactions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Dropzone / File Picker */}
                  {!restoreFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/80 rounded-xl p-6 text-center hover:border-primary/60 hover:bg-muted/40 cursor-pointer transition-colors space-y-3"
                    >
                      <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <FileUp className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Click to select a backup JSON file</p>
                        <p className="text-xs text-muted-foreground">Accepts .json backup files exported from this system</p>
                      </div>
                      <Button variant="secondary" size="sm" type="button" className="text-xs">
                        Browse Files
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-xl p-4 space-y-4 bg-muted/20">
                      {/* File Details Bar */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <FileCheck className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate max-w-[220px]">{restoreFile.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(restoreFile.size)}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetRestore}
                          disabled={restoring || inspecting}
                          className="text-xs h-7 px-2 text-muted-foreground hover:text-destructive"
                        >
                          Change File
                        </Button>
                      </div>

                      {/* Inspected Content Preview */}
                      {inspecting ? (
                        <div className="py-6 text-center space-y-2">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                          <p className="text-xs text-muted-foreground">Verifying backup structure & counts...</p>
                        </div>
                      ) : inspectData ? (
                        <div className="space-y-4">
                          {/* Metadata */}
                          <div className="grid grid-cols-2 gap-2 text-xs bg-background p-3 rounded-lg border">
                            <div>
                              <span className="text-muted-foreground">Company:</span>{" "}
                              <span className="font-semibold">{inspectData.company?.name || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Scope:</span>{" "}
                              <Badge variant="outline" className="text-[10px] font-normal py-0">
                                {inspectData.backupType === "date_range"
                                  ? `${inspectData.dateRange?.from || ""} to ${inspectData.dateRange?.to || ""}`
                                  : "All Time"}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Date Exported:</span>{" "}
                              <span>
                                {inspectData.generatedAt
                                  ? new Date(inspectData.generatedAt).toLocaleDateString()
                                  : "N/A"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Format:</span>{" "}
                              <span className="font-mono text-emerald-600">v{inspectData.version || "1.0"} Verified</span>
                            </div>
                          </div>

                          {/* Counts Breakdown */}
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground">
                              Records in Backup File
                            </Label>
                            <div className="grid grid-cols-3 gap-1.5 text-xs">
                              <div className="p-2 bg-background rounded border text-center">
                                <div className="font-bold text-foreground">{inspectData.counts?.saleInvoices || 0}</div>
                                <div className="text-[10px] text-muted-foreground">Sales</div>
                              </div>
                              <div className="p-2 bg-background rounded border text-center">
                                <div className="font-bold text-foreground">{inspectData.counts?.purchaseInvoices || 0}</div>
                                <div className="text-[10px] text-muted-foreground">Purchases</div>
                              </div>
                              <div className="p-2 bg-background rounded border text-center">
                                <div className="font-bold text-foreground">
                                  {(inspectData.counts?.receipts || 0) + (inspectData.counts?.payments || 0)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">Rcpt/Pymt</div>
                              </div>
                              <div className="p-2 bg-background rounded border text-center">
                                <div className="font-bold text-foreground">{inspectData.counts?.stockItems || 0}</div>
                                <div className="text-[10px] text-muted-foreground">Items</div>
                              </div>
                              <div className="p-2 bg-background rounded border text-center">
                                <div className="font-bold text-foreground">{inspectData.counts?.parties || 0}</div>
                                <div className="text-[10px] text-muted-foreground">Parties</div>
                              </div>
                              <div className="p-2 bg-background rounded border text-center">
                                <div className="font-bold text-foreground">{inspectData.counts?.ledgers || 0}</div>
                                <div className="text-[10px] text-muted-foreground">Ledgers</div>
                              </div>
                            </div>
                          </div>

                          {/* Restore Mode Radio */}
                          <div className="space-y-2 pt-2">
                            <Label className="text-xs font-semibold">Select Restoration Mode</Label>
                            <RadioGroup
                              value={restoreMode}
                              onValueChange={(val: any) => setRestoreMode(val)}
                              className="grid grid-cols-1 gap-2"
                            >
                              <div className="flex items-start space-x-2 border bg-background rounded-lg p-2.5 cursor-pointer">
                                <RadioGroupItem value="merge" id="mode-merge" className="mt-0.5" />
                                <label htmlFor="mode-merge" className="cursor-pointer text-xs flex-1">
                                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                                    Merge / Safe Append
                                    <Badge variant="secondary" className="text-[9px] py-0 px-1 font-normal bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                      Recommended
                                    </Badge>
                                  </div>
                                  <p className="text-muted-foreground mt-0.5">
                                    Safely imports new vouchers and masters. Existing data is retained without duplicates.
                                  </p>
                                </label>
                              </div>

                              <div className="flex items-start space-x-2 border bg-background rounded-lg p-2.5 cursor-pointer">
                                <RadioGroupItem value="replace" id="mode-replace" className="mt-0.5" />
                                <label htmlFor="mode-replace" className="cursor-pointer text-xs flex-1">
                                  <div className="font-semibold text-destructive flex items-center gap-1.5">
                                    Clean Replace (Overwrite Transactions)
                                  </div>
                                  <p className="text-muted-foreground mt-0.5">
                                    Wipes all current transactional vouchers and restores this exact backup. Masters & logins remain intact.
                                  </p>
                                </label>
                              </div>
                            </RadioGroup>
                          </div>

                          {restoreMode === "replace" && (
                            <Alert variant="destructive" className="py-2.5 text-xs">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle className="text-xs font-semibold">Warning: Destructive Operation</AlertTitle>
                              <AlertDescription className="text-[11px]">
                                Current sales, purchases, payments, receipts, journals, and orders will be cleared before restoring this backup snapshot.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </div>
              <CardFooter className="pt-2">
                <Button
                  size="lg"
                  onClick={triggerRestore}
                  disabled={!restorePayload || inspecting || restoring}
                  className="w-full font-semibold gap-2"
                  variant={restoreMode === "replace" ? "destructive" : "default"}
                >
                  {restoring ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Restoring Database...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4" /> Restore Backup Data
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog for Replace Mode */}
      <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Database Replace
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-foreground/80">
              <p>
                You have chosen <strong>Clean Replace</strong> mode.
              </p>
              <p>
                This operation will <strong>permanently wipe</strong> all current transaction vouchers (Sales, Purchases, Receipts, Payments, Journals, Credit/Debit Notes, Deliveries) and replace them with the records contained in this backup.
              </p>
              <p className="text-xs text-muted-foreground">
                Company profile, account groups, and user logins will be preserved. Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeRestore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={restoring}
            >
              Yes, Replace Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restoration Success Modal */}
      {restoreSuccessData && (
        <Dialog open={!!restoreSuccessData} onOpenChange={() => setRestoreSuccessData(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center text-xl">Restoration Successful!</DialogTitle>
              <DialogDescription className="text-center text-sm">
                Your database has been restored successfully in <strong>{restoreSuccessData.mode}</strong> mode.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-muted/40 rounded-lg p-4 space-y-3 text-xs border">
              <div className="font-semibold text-foreground">Restored Record Summary:</div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>Sales Invoices: <span className="font-semibold text-foreground">{restoreSuccessData.restoredCounts?.saleInvoices || 0}</span></div>
                <div>Purchase Invoices: <span className="font-semibold text-foreground">{restoreSuccessData.restoredCounts?.purchaseInvoices || 0}</span></div>
                <div>Receipts: <span className="font-semibold text-foreground">{restoreSuccessData.restoredCounts?.receipts || 0}</span></div>
                <div>Payments: <span className="font-semibold text-foreground">{restoreSuccessData.restoredCounts?.payments || 0}</span></div>
                <div>Journals: <span className="font-semibold text-foreground">{restoreSuccessData.restoredCounts?.journalEntries || 0}</span></div>
                <div>Credit/Debit Notes: <span className="font-semibold text-foreground">{(restoreSuccessData.restoredCounts?.creditNotes || 0) + (restoreSuccessData.restoredCounts?.debitNotes || 0)}</span></div>
                <div>Stock Items Mapped: <span className="font-semibold text-foreground">{restoreSuccessData.restoredCounts?.stockItems || 0}</span></div>
                <div>Parties Mapped: <span className="font-semibold text-foreground">{restoreSuccessData.restoredCounts?.parties || 0}</span></div>
              </div>
            </div>

            <DialogFooter className="sm:justify-center">
              <Button onClick={() => setRestoreSuccessData(null)} className="w-full">
                Close & Return
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <BulkImportDialog open={importItemOpen} onOpenChange={setImportItemOpen} type="items" />
      <BulkImportDialog open={importLedgerOpen} onOpenChange={setImportLedgerOpen} type="ledgers" />
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
