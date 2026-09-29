import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { customFetch, getListStockItemsQueryKey, getListLedgersQueryKey, getListPartiesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  downloadStockItemTemplate,
  downloadLedgerTemplate,
  parseExcelFile,
  parseStockItemRows,
  parseLedgerRows,
  ParsedStockItem,
  ParsedLedger,
} from "@/lib/excel-import";
import { formatCurrency } from "@/lib/format";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, RefreshCw, X, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "items" | "ledgers";
  onSuccess?: () => void;
}

export function BulkImportDialog({ open, onOpenChange, type, onSuccess }: BulkImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "update">("skip");

  const [parsedItems, setParsedItems] = useState<ParsedStockItem[]>([]);
  const [parsedLedgers, setParsedLedgers] = useState<ParsedLedger[]>([]);

  const handleDownloadTemplate = () => {
    if (type === "items") {
      downloadStockItemTemplate();
      toast({ title: "Template downloaded", description: "Stock_Items_Import_Template.xlsx has been downloaded." });
    } else {
      downloadLedgerTemplate();
      toast({ title: "Template downloaded", description: "Ledgers_Import_Template.xlsx has been downloaded." });
    }
  };

  const resetState = () => {
    setFile(null);
    setParsing(false);
    setImporting(false);
    setParsedItems([]);
    setParsedLedgers([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setParsing(true);

    try {
      const rawRows = await parseExcelFile(selected);
      if (!rawRows.length) {
        toast({ title: "Empty file", description: "No records found in uploaded file.", variant: "destructive" });
        setParsing(false);
        return;
      }

      if (type === "items") {
        // Fetch existing items to identify duplicates
        const existing = await customFetch<any[]>("/api/stock-items").catch(() => []);
        const existingSet = new Set(existing.map((item: any) => String(item.name || "").trim().toLowerCase()));
        const parsed = parseStockItemRows(rawRows, existingSet);
        setParsedItems(parsed);
      } else {
        // Fetch existing ledgers and parties to identify duplicates
        const [existingLedgers, existingParties] = await Promise.all([
          customFetch<any[]>("/api/ledgers").catch(() => []),
          customFetch<any[]>("/api/parties").catch(() => []),
        ]);
        const existingSet = new Set([
          ...existingLedgers.map((l: any) => String(l.name || "").trim().toLowerCase()),
          ...existingParties.map((p: any) => String(p.name || "").trim().toLowerCase()),
        ]);
        const parsed = parseLedgerRows(rawRows, existingSet);
        setParsedLedgers(parsed);
      }
    } catch (err: any) {
      console.error("Failed to parse file:", err);
      toast({
        title: "Failed to read file",
        description: err.message || "Please make sure the file is a valid .xlsx, .xls, or .csv spreadsheet.",
        variant: "destructive",
      });
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const isItems = type === "items";
  const records = isItems ? parsedItems : parsedLedgers;

  const validCount = records.filter(r => r.status === "valid").length;
  const duplicateCount = records.filter(r => r.status === "duplicate").length;
  const errorCount = records.filter(r => r.status === "error").length;

  const actionableCount = duplicateStrategy === "update" ? (validCount + duplicateCount) : validCount;

  const handleImportSubmit = async () => {
    if (!records.length) return;
    setImporting(true);

    try {
      if (isItems) {
        const payload = parsedItems
          .filter(r => r.status !== "error")
          .map(r => ({
            name: r.name,
            category: r.category,
            hsnCode: r.hsnCode,
            unit: r.unit,
            purchaseRate: r.purchaseRate,
            saleRate: r.saleRate,
            physicalStock: r.openingStock,
            minStockLevel: r.minStockLevel,
            gstApplicable: r.gstApplicable,
            gstRate: r.gstRate,
            taxType: r.taxType,
            barcode: r.barcode,
            brand: r.brand,
          }));

        const res = await customFetch<any>("/api/stock-items/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload, onDuplicate: duplicateStrategy }),
        });

        queryClient.invalidateQueries({ queryKey: getListStockItemsQueryKey() });
        toast({
          title: "Import Complete",
          description: `Successfully created ${res.created} items, updated ${res.updated}, skipped ${res.skipped}.`,
        });
      } else {
        const payload = parsedLedgers
          .filter(r => r.status !== "error")
          .map(r => ({
            name: r.name,
            group: r.group,
            openingBalance: r.openingBalance,
            balanceType: r.balanceType,
            gstin: r.gstin,
            gstType: r.gstType,
            phone: r.phone,
            email: r.email,
            address: r.address,
            city: r.city,
            state: r.state,
            pincode: r.pincode,
            bankName: r.bankName,
            accountNumber: r.accountNumber,
            ifscCode: r.ifscCode,
          }));

        const res = await customFetch<any>("/api/ledgers/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ledgers: payload, onDuplicate: duplicateStrategy }),
        });

        queryClient.invalidateQueries({ queryKey: getListLedgersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPartiesQueryKey() });
        toast({
          title: "Import Complete",
          description: `Successfully created ${res.created} ledgers, updated ${res.updated}, skipped ${res.skipped}.`,
        });
      }

      onSuccess?.();
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      console.error("Bulk import failed:", err);
      toast({
        title: "Import Failed",
        description: err?.data?.error || err.message || "Failed to process import.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {isItems ? "Bulk Import Stock Items" : "Bulk Import Ledgers & Parties"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {isItems
              ? "Upload an Excel (.xlsx / .xls) or CSV file with your inventory items. Use our template for 100% accuracy."
              : "Upload an Excel (.xlsx / .xls) or CSV file with customer, supplier, bank, and expense accounts."}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {/* Step 1: Download Template Banner */}
          <Card className="bg-primary/5 border-primary/20 shadow-none">
            <CardContent className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">1. Download Sample Excel Template</p>
                  <p className="text-xs text-muted-foreground">Pre-filled with correct column headers and sample data rows.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="shrink-0 gap-1.5 bg-background shadow-xs hover:bg-primary/10">
                <Download className="h-4 w-4 text-primary" /> Download Sample (.xlsx)
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Upload Area */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">2. Select or Drop Your Excel File (.xlsx, .xls, .csv)</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center",
                file ? "border-primary/50 bg-primary/5" : "border-muted hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileUp className="h-8 w-8 text-primary/70 mb-2" />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(1)} KB — Click to choose a different file</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">Click to browse or drag and drop your file here</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Supports Microsoft Excel (.xlsx, .xls) and CSV</p>
                </div>
              )}
            </div>
          </div>

          {/* Parsing spinner */}
          {parsing && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              Reading and validating spreadsheet...
            </div>
          )}

          {/* Step 3: Preview and Stats */}
          {!parsing && records.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-semibold text-xs py-1 px-2.5">
                    Total Rows: {records.length}
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold text-xs py-1 px-2.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valid New: {validCount}
                  </Badge>
                  {duplicateCount > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-semibold text-xs py-1 px-2.5 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Existing: {duplicateCount}
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 font-semibold text-xs py-1 px-2.5 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Errors: {errorCount}
                    </Badge>
                  )}
                </div>

                {duplicateCount > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <Label className="text-xs text-muted-foreground">If record already exists:</Label>
                    <Select value={duplicateStrategy} onValueChange={(v: "skip" | "update") => setDuplicateStrategy(v)}>
                      <SelectTrigger className="h-8 text-xs w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip existing records</SelectItem>
                        <SelectItem value="update">Overwrite / Update details</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Scrollable table preview */}
              <div className="border rounded-md max-h-64 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 text-xs">
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead>Name</TableHead>
                      {isItems ? (
                        <>
                          <TableHead>Category</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>HSN</TableHead>
                          <TableHead className="text-right">Purchase Rate</TableHead>
                          <TableHead className="text-right">Sale Rate</TableHead>
                          <TableHead className="text-right">Opening Stock</TableHead>
                          <TableHead>GST</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Group</TableHead>
                          <TableHead className="text-right">Opening Bal</TableHead>
                          <TableHead>GSTIN</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>State</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {records.map((r: any, idx: number) => {
                      const isDup = r.status === "duplicate";
                      const isErr = r.status === "error";
                      return (
                        <TableRow key={idx} className={cn(isErr ? "bg-red-50/60" : isDup ? "bg-amber-50/40" : "")}>
                          <TableCell>
                            {isErr ? (
                              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-[10px]">
                                Error
                              </Badge>
                            ) : isDup ? (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                                {duplicateStrategy === "update" ? "Update" : "Skip"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-[10px]">
                                Ready
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={r.name}>
                            {r.name || <span className="text-destructive italic">Missing name</span>}
                            {r.errors?.length > 0 && (
                              <p className="text-[10px] text-destructive mt-0.5">{r.errors.join(", ")}</p>
                            )}
                          </TableCell>
                          {isItems ? (
                            <>
                              <TableCell>{r.category || "-"}</TableCell>
                              <TableCell>{r.unit || "pcs"}</TableCell>
                              <TableCell className="font-mono text-[11px]">{r.hsnCode || "-"}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.purchaseRate)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(r.saleRate)}</TableCell>
                              <TableCell className="text-right font-medium">{r.openingStock}</TableCell>
                              <TableCell>{r.gstApplicable ? `${r.gstRate}%` : "Nil"}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell>{r.group}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(r.openingBalance)} {r.balanceType?.toUpperCase()}
                              </TableCell>
                              <TableCell className="font-mono text-[11px]">{r.gstin || "-"}</TableCell>
                              <TableCell>{r.phone || "-"}</TableCell>
                              <TableCell>{r.state || "-"}</TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-3 border-t flex items-center justify-between sm:justify-between w-full">
          <Button variant="ghost" size="sm" onClick={() => { resetState(); onOpenChange(false); }}>
            Cancel
          </Button>

          <Button
            size="sm"
            disabled={actionableCount === 0 || importing || parsing}
            onClick={handleImportSubmit}
            className="gap-2"
          >
            {importing && <RefreshCw className="h-4 w-4 animate-spin" />}
            Import {actionableCount} {isItems ? "Items" : "Ledgers"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
