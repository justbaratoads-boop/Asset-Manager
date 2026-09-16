import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ExportButtons } from "@/components/export-buttons";
import { ColumnSelector } from "@/components/column-selector";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useFY } from "@/lib/financial-year";
import { useLocation } from "wouter";
import { Building2, CreditCard, ArrowDownRight, ArrowUpRight, Search, X, ExternalLink, RefreshCw } from "lucide-react";

const ALL_COLUMNS = [
  { header: "Date", key: "date", format: formatDate },
  { header: "Description", key: "description" },
  { header: "Ref#", key: "ref" },
  { header: "Party", key: "party" },
  { header: "Money In", key: "cashIn", format: (v: any) => (v > 0 ? String(Number(v).toFixed(2)) : "") },
  { header: "Money Out", key: "cashOut", format: (v: any) => (v > 0 ? String(Number(v).toFixed(2)) : "") },
  { header: "Balance", key: "balance", format: (v: any) => String(Number(v).toFixed(2)) },
];

interface BankAccount {
  id: number;
  name: string;
  group: string;
  bankName?: string;
  bankBranch?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
  balanceType: string;
  entries: any[];
}

export default function BankBook() {
  const { globalFrom, globalTo, setGlobalFrom, setGlobalTo, clearGlobalDates } = useFY();
  const [, setLocation] = useLocation();

  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [bankSearch, setBankSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bank-book", { from: globalFrom, to: globalTo }],
    queryFn: () => customFetch(`/api/reports/bank-book?from=${globalFrom || ""}&to=${globalTo || ""}`),
  });

  const banks: BankAccount[] = (data as any)?.banks || [];
  const summary = (data as any)?.summary || {
    totalBanks: banks.length,
    totalIn: (data as any)?.totalIn || 0,
    totalOut: (data as any)?.totalOut || 0,
    netBalance: banks.reduce((s, b) => s + (b.closingBalance || 0), 0),
  };

  const filteredBanks = banks.filter((b) => {
    if (!bankSearch) return true;
    const q = bankSearch.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.accountNumber && b.accountNumber.toLowerCase().includes(q)) ||
      (b.ifscCode && b.ifscCode.toLowerCase().includes(q)) ||
      (b.bankBranch && b.bankBranch.toLowerCase().includes(q))
    );
  });

  const { visibleKeys, visibleColumns, toggle, setAll, allColumns } = useColumnVisibility("bank-book-modal", ALL_COLUMNS);
  const vis = visibleKeys;

  const handleBankClick = (bank: BankAccount) => {
    setSelectedBank(bank);
    setModalSearch("");
    setModalOpen(true);
  };

  const modalEntries = (selectedBank?.entries || []).filter((e: any) => {
    if (!modalSearch) return true;
    const q = modalSearch.toLowerCase();
    return (
      (e.ref && String(e.ref).toLowerCase().includes(q)) ||
      (e.party && String(e.party).toLowerCase().includes(q)) ||
      (e.description && String(e.description).toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Bank Book
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage all bank accounts, check balances, and view transaction history
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter & Clear Option */}
          <div className="flex items-center gap-1.5 bg-card border rounded-lg p-1.5 shadow-sm">
            <Label className="text-xs text-muted-foreground ml-1">From</Label>
            <Input
              type="date"
              value={globalFrom || ""}
              onChange={(e) => setGlobalFrom(e.target.value)}
              className="h-8 w-34 text-xs"
              title="From Date (Saved automatically)"
            />
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={globalTo || ""}
              onChange={(e) => setGlobalTo(e.target.value)}
              className="h-8 w-34 text-xs"
              title="To Date (Saved automatically)"
            />
            {(globalFrom || globalTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearGlobalDates}
                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                title="Clear date filter"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Bank Accounts</p>
              <p className="text-2xl font-bold mt-1">{banks.length}</p>
            </div>
            <div className="p-2.5 bg-primary/10 rounded-full text-primary">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Money In</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.totalIn)}</p>
            </div>
            <div className="p-2.5 bg-green-500/10 rounded-full text-green-600">
              <ArrowDownRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Money Out</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(summary.totalOut)}</p>
            </div>
            <div className="p-2.5 bg-red-500/10 rounded-full text-red-600">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Net Bank Balance</p>
              <p className={`text-2xl font-bold mt-1 ${summary.netBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(summary.netBalance)}
              </p>
            </div>
            <div className="p-2.5 bg-muted rounded-full text-foreground">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Bank List / Table */}
      <Card>
        <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Bank Accounts Overview</CardTitle>
            <CardDescription className="text-xs">
              Click on any bank account to view its full transaction ledger popup
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search bank name / account..."
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-muted/40"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[220px]">Bank / Ledger Name</TableHead>
                <TableHead>Account Details</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="text-right text-green-600">Total Money In</TableHead>
                <TableHead className="text-right text-red-600">Total Money Out</TableHead>
                <TableHead className="text-right font-bold">Closing Balance</TableHead>
                <TableHead className="text-center w-[120px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading bank accounts...
                  </TableCell>
                </TableRow>
              ) : !filteredBanks.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No bank accounts found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBanks.map((bank) => (
                  <TableRow
                    key={bank.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleBankClick(bank)}
                  >
                    <TableCell className="font-semibold text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <div>{bank.name}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">{bank.group}</div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs">
                      {bank.accountNumber ? (
                        <div>
                          <span className="font-mono">{bank.accountNumber}</span>
                          {bank.ifscCode && (
                            <span className="text-muted-foreground ml-2">IFSC: {bank.ifscCode}</span>
                          )}
                          {bank.bankBranch && (
                            <div className="text-[10px] text-muted-foreground">{bank.bankBranch}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right text-xs">
                      {formatCurrency(bank.openingBalance)}
                    </TableCell>

                    <TableCell className="text-right text-xs text-green-600 font-medium">
                      {bank.totalIn > 0 ? formatCurrency(bank.totalIn) : "-"}
                    </TableCell>

                    <TableCell className="text-right text-xs text-red-600 font-medium">
                      {bank.totalOut > 0 ? formatCurrency(bank.totalOut) : "-"}
                    </TableCell>

                    <TableCell className="text-right font-bold text-sm">
                      <span className={bank.closingBalance < 0 ? "text-red-600" : "text-green-600"}>
                        {formatCurrency(bank.closingBalance)}
                      </span>
                      <Badge variant="outline" className="ml-1.5 text-[10px] py-0 px-1 font-mono">
                        {bank.balanceType}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleBankClick(bank)}
                        className="h-7 text-xs px-2.5"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" /> View Txns
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transactions Pop-Up Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6">
          {selectedBank && (
            <>
              <DialogHeader className="pb-3 border-b">
                <div className="flex items-center justify-between pr-6 flex-wrap gap-2">
                  <div>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" /> {selectedBank.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-1">
                      {selectedBank.accountNumber && (
                        <span className="mr-3">A/C: <strong className="font-mono text-foreground">{selectedBank.accountNumber}</strong></span>
                      )}
                      {selectedBank.ifscCode && (
                        <span className="mr-3">IFSC: <strong className="font-mono text-foreground">{selectedBank.ifscCode}</strong></span>
                      )}
                      {selectedBank.bankBranch && (
                        <span>Branch: <strong className="text-foreground">{selectedBank.bankBranch}</strong></span>
                      )}
                    </DialogDescription>
                  </div>
                  <Badge variant="outline" className="text-xs px-2.5 py-1 bg-muted">
                    Total Transactions: {selectedBank.entries?.length || 0}
                  </Badge>
                </div>
              </DialogHeader>

              {/* Modal Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
                <div className="bg-muted/40 p-2.5 rounded-lg border">
                  <span className="text-[11px] text-muted-foreground block">Opening Balance</span>
                  <span className="text-sm font-semibold">{formatCurrency(selectedBank.openingBalance)}</span>
                </div>
                <div className="bg-green-500/10 p-2.5 rounded-lg border border-green-500/20">
                  <span className="text-[11px] text-green-700 block">Total Money In</span>
                  <span className="text-sm font-bold text-green-600">{formatCurrency(selectedBank.totalIn)}</span>
                </div>
                <div className="bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                  <span className="text-[11px] text-red-700 block">Total Money Out</span>
                  <span className="text-sm font-bold text-red-600">{formatCurrency(selectedBank.totalOut)}</span>
                </div>
                <div className="bg-muted p-2.5 rounded-lg border">
                  <span className="text-[11px] text-muted-foreground block">Closing Balance</span>
                  <span className={`text-sm font-bold ${selectedBank.closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(selectedBank.closingBalance)} ({selectedBank.balanceType})
                  </span>
                </div>
              </div>

              {/* Modal Filter Controls & Export */}
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="relative w-72">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search ref #, party, description..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-muted/30"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <ColumnSelector
                    allColumns={allColumns}
                    visibleKeys={vis}
                    onToggle={toggle}
                    onSelectAll={() => setAll(true)}
                    onClearAll={() => setAll(false)}
                  />
                  <ExportButtons
                    data={selectedBank.entries || []}
                    columns={visibleColumns}
                    filename={`bank-statement-${selectedBank.name.toLowerCase().replace(/\s+/g, "-")}`}
                    title={`${selectedBank.name} Statement`}
                  />
                </div>
              </div>

              {/* Modal Transaction Table */}
              <div className="flex-1 overflow-y-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                    <TableRow className="bg-muted/40">
                      {vis.has("date") && <TableHead className="w-[100px]">Date</TableHead>}
                      {vis.has("description") && <TableHead>Description</TableHead>}
                      {vis.has("ref") && <TableHead className="w-[110px]">Ref#</TableHead>}
                      {vis.has("party") && <TableHead>Party</TableHead>}
                      {vis.has("cashIn") && <TableHead className="text-right text-green-600">Money In</TableHead>}
                      {vis.has("cashOut") && <TableHead className="text-right text-red-600">Money Out</TableHead>}
                      {vis.has("balance") && <TableHead className="text-right">Balance</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!modalEntries.length ? (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">
                          No transactions found for this bank account in the selected period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      modalEntries.map((e: any, i: number) => {
                        const destPath = e.id
                          ? e.type === "payment"
                            ? `/accounts/payments/${e.id}/edit`
                            : e.type === "receipt"
                            ? `/accounts/receipts/${e.id}/edit`
                            : e.type === "sale-invoice"
                            ? `/sales/invoices/${e.id}`
                            : e.type === "purchase-invoice"
                            ? `/purchase/invoices/${e.id}/edit`
                            : null
                          : null;
                        return (
                          <TableRow
                            key={i}
                            className={destPath ? "cursor-pointer hover:bg-muted/60 transition-colors" : ""}
                            onClick={() => {
                              if (destPath) {
                                setModalOpen(false);
                                setLocation(destPath);
                              }
                            }}
                          >
                            {vis.has("date") && <TableCell className="text-xs font-medium">{formatDate(e.date)}</TableCell>}
                            {vis.has("description") && (
                              <TableCell className="max-w-xs truncate text-xs">
                                {e.description || "-"}
                              </TableCell>
                            )}
                            {vis.has("ref") && (
                              <TableCell className="font-mono text-xs text-primary font-medium">
                                {e.ref}
                              </TableCell>
                            )}
                            {vis.has("party") && <TableCell className="text-xs">{e.party || "-"}</TableCell>}
                            {vis.has("cashIn") && (
                              <TableCell className="text-right text-xs text-green-600 font-medium">
                                {e.cashIn > 0 ? formatCurrency(e.cashIn) : ""}
                              </TableCell>
                            )}
                            {vis.has("cashOut") && (
                              <TableCell className="text-right text-xs text-red-600 font-medium">
                                {e.cashOut > 0 ? formatCurrency(e.cashOut) : ""}
                              </TableCell>
                            )}
                            {vis.has("balance") && (
                              <TableCell className={`text-right text-xs font-semibold ${e.balance < 0 ? "text-red-600" : ""}`}>
                                {formatCurrency(e.balance)}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
