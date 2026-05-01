import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setupApi } from "./lib/api-setup";
import { AuthProvider, useAuth } from "./lib/auth";
import { ThemeProvider } from "./components/theme-provider";
import { Layout } from "./components/layout";
import { FYProvider } from "./lib/financial-year";

// Eagerly loaded
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import NotFound from "@/pages/not-found";

// Sales
import SaleInvoiceList from "@/pages/sales/invoice-list";
import SaleInvoiceView from "@/pages/sales/invoice-view";
import SaleInvoiceForm from "@/pages/sales/invoice-form";
import OrderList from "@/pages/sales/orders";
import OrderForm from "@/pages/sales/order-form";

// Purchase
import PurchaseInvoiceList from "@/pages/purchase/invoice-list";
import PurchaseInvoiceForm from "@/pages/purchase/invoice-form";
import PurchaseOrderList from "@/pages/purchase/orders";
import PurchaseOrderForm from "@/pages/purchase/order-form";

// Accounts
import PartiesList from "@/pages/accounts/parties";
import PartyForm from "@/pages/accounts/party-form";
import PartyLedger from "@/pages/accounts/party-ledger";
import LedgersList from "@/pages/accounts/ledgers";
import JournalList from "@/pages/accounts/journal";
import JournalForm from "@/pages/accounts/journal-form";
import PaymentList from "@/pages/accounts/payments";
import PaymentForm from "@/pages/accounts/payment-form";
import ReceiptList from "@/pages/accounts/receipts";
import ReceiptForm from "@/pages/accounts/receipt-form";
import CreditNotesList from "@/pages/accounts/credit-notes";
import CreditNoteForm from "@/pages/accounts/credit-note-form";
import DebitNotesList from "@/pages/accounts/debit-notes";
import DebitNoteForm from "@/pages/accounts/debit-note-form";

// Inventory
import StockItemList from "@/pages/inventory/items";
import ItemForm from "@/pages/inventory/item-form";
import ItemDetail from "@/pages/inventory/item-detail";
import Categories from "@/pages/inventory/categories";
import CurrentStock from "@/pages/inventory/current-stock";
import Batches from "@/pages/inventory/batches";

// Reports
import ReportsLanding from "@/pages/reports/index";
import DayBook from "@/pages/reports/day-book";
import TrialBalance from "@/pages/reports/trial-balance";
import ProfitLoss from "@/pages/reports/profit-loss";
import BalanceSheet from "@/pages/reports/balance-sheet";
import Registers from "@/pages/reports/registers";
import CashBook from "@/pages/reports/cash-book";
import AllTransactions from "@/pages/reports/all-transactions";
import PartyStatement from "@/pages/reports/party-statement";
import StockSummary from "@/pages/reports/stock-summary";
import DeliveryReport from "@/pages/reports/delivery-report";

// GST
import GSTDashboard from "@/pages/gst/index";

// Delivery
import DeliveryPage from "@/pages/delivery/index";

// Settings
import CompanySettings from "@/pages/settings/company";
import UsersSettings from "@/pages/settings/users";
import PrintSettings from "@/pages/settings/print";

setupApi();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PR({ component: Component, path }: { component: any; path: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!isAuthenticated) return null;

  return (
    <Route path={path}>
      <Layout>
        <Component />
      </Layout>
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <PR path="/" component={Dashboard} />

      {/* Sales */}
      <PR path="/sales/invoices" component={SaleInvoiceList} />
      <PR path="/sales/invoices/new" component={SaleInvoiceForm} />
      <PR path="/sales/invoices/:id" component={SaleInvoiceView} />
      <PR path="/sales/orders" component={OrderList} />
      <PR path="/sales/orders/new" component={OrderForm} />
      <PR path="/sales/orders/:id" component={OrderForm} />

      {/* Purchase */}
      <PR path="/purchase/invoices" component={PurchaseInvoiceList} />
      <PR path="/purchase/invoices/new" component={PurchaseInvoiceForm} />
      <PR path="/purchase/orders" component={PurchaseOrderList} />
      <PR path="/purchase/orders/new" component={PurchaseOrderForm} />

      {/* Accounts */}
      <PR path="/accounts/parties" component={PartiesList} />
      <PR path="/accounts/parties/new" component={PartyForm} />
      <PR path="/accounts/parties/:id" component={PartyLedger} />
      <PR path="/accounts/ledgers" component={LedgersList} />
      <PR path="/accounts/journal" component={JournalList} />
      <PR path="/accounts/journal/new" component={JournalForm} />
      <PR path="/accounts/payments" component={PaymentList} />
      <PR path="/accounts/payments/new" component={PaymentForm} />
      <PR path="/accounts/receipts" component={ReceiptList} />
      <PR path="/accounts/receipts/new" component={ReceiptForm} />
      <PR path="/accounts/credit-notes" component={CreditNotesList} />
      <PR path="/accounts/credit-notes/new" component={CreditNoteForm} />
      <PR path="/accounts/debit-notes" component={DebitNotesList} />
      <PR path="/accounts/debit-notes/new" component={DebitNoteForm} />

      {/* Inventory */}
      <PR path="/inventory/items" component={StockItemList} />
      <PR path="/inventory/items/new" component={ItemForm} />
      <PR path="/inventory/items/:id" component={ItemDetail} />
      <PR path="/inventory/categories" component={Categories} />
      <PR path="/inventory/current-stock" component={CurrentStock} />
      <PR path="/inventory/batches" component={Batches} />

      {/* Reports */}
      <PR path="/reports" component={ReportsLanding} />
      <PR path="/reports/day-book" component={DayBook} />
      <PR path="/reports/trial-balance" component={TrialBalance} />
      <PR path="/reports/profit-loss" component={ProfitLoss} />
      <PR path="/reports/balance-sheet" component={BalanceSheet} />
      <PR path="/reports/sale-register" component={Registers} />
      <PR path="/reports/purchase-register" component={Registers} />
      <PR path="/reports/cash-book" component={CashBook} />
      <PR path="/reports/all-transactions" component={AllTransactions} />
      <PR path="/reports/party-statement" component={PartyStatement} />
      <PR path="/reports/stock-summary" component={StockSummary} />
      <PR path="/reports/delivery-report" component={DeliveryReport} />

      {/* GST */}
      <PR path="/gst" component={GSTDashboard} />
      <PR path="/gst/gstr3b" component={GSTDashboard} />
      <PR path="/gst/gstr2b" component={GSTDashboard} />
      <PR path="/gst/hsn-summary" component={GSTDashboard} />

      {/* Delivery */}
      <PR path="/delivery" component={DeliveryPage} />

      {/* Settings */}
      <PR path="/settings" component={CompanySettings} />
      <PR path="/settings/company" component={CompanySettings} />
      <PR path="/settings/print" component={PrintSettings} />
      <PR path="/settings/users" component={UsersSettings} />
      <PR path="/settings/vehicles" component={DeliveryPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="accounting-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <FYProvider startMonth={4}>
                <Router />
              </FYProvider>
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
