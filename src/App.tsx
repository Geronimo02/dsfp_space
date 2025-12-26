import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";
import { User, Session } from "@supabase/supabase-js";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { ModuleProtectedRoute } from "./components/ModuleProtectedRoute";

// Lazy load all page components
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const POS = lazy(() => import("./pages/POS"));
const Products = lazy(() => import("./pages/Products"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Customers = lazy(() => import("./pages/Customers"));
const Sales = lazy(() => import("./pages/Sales"));
const TechnicalServices = lazy(() => import("./pages/TechnicalServices"));
const Employees = lazy(() => import("./pages/Employees"));
const CashRegister = lazy(() => import("./pages/CashRegister"));
const Purchases = lazy(() => import("./pages/Purchases"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const PurchaseReception = lazy(() => import("./pages/PurchaseReception"));
const PurchaseReturns = lazy(() => import("./pages/PurchaseReturns"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const AccessLogs = lazy(() => import("./pages/AccessLogs"));
const Quotations = lazy(() => import("./pages/Quotations"));
const DeliveryNotes = lazy(() => import("./pages/DeliveryNotes"));
const CustomerAccount = lazy(() => import("./pages/CustomerAccount"));
const Promotions = lazy(() => import("./pages/Promotions"));
const Returns = lazy(() => import("./pages/Returns"));
const InventoryAlerts = lazy(() => import("./pages/InventoryAlerts"));
const Reservations = lazy(() => import("./pages/Reservations"));
const Expenses = lazy(() => import("./pages/Expenses"));
const BulkOperations = lazy(() => import("./pages/BulkOperations"));
const Warehouses = lazy(() => import("./pages/Warehouses"));
const WarehouseStock = lazy(() => import("./pages/WarehouseStock"));
const WarehouseTransfers = lazy(() => import("./pages/WarehouseTransfers"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SetPasswordToken = lazy(() => import("./pages/SetPasswordToken"));
const POSPoints = lazy(() => import("./pages/POSPoints"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const Checks = lazy(() => import("./pages/Checks"));
const MonthlyClosing = lazy(() => import("./pages/MonthlyClosing"));
const AccountantReports = lazy(() => import("./pages/AccountantReports"));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const Commissions = lazy(() => import("./pages/Commissions"));
const StockReservations = lazy(() => import("./pages/StockReservations"));
const BankAccounts = lazy(() => import("./pages/BankAccounts"));
const BankMovements = lazy(() => import("./pages/BankMovements"));
const CardMovements = lazy(() => import("./pages/CardMovements"));
const Retentions = lazy(() => import("./pages/Retentions"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Payroll = lazy(() => import("./pages/Payroll"));
const AFIPBilling = lazy(() => import("./pages/AFIPBilling"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const CustomerSupport = lazy(() => import("./pages/CustomerSupport"));
const CustomerSupportSettings = lazy(() => import("./pages/CustomerSupportSettings"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const PlatformSupport = lazy(() => import("./pages/PlatformSupport"));
const ModuleNotAvailable = lazy(() => import("./pages/ModuleNotAvailable"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AccountsReceivable = lazy(() => import("./pages/AccountsReceivable"));
const EmailConfig = lazy(() => import("./pages/EmailConfig"));
const SignupWizard = lazy(() => import("./pages/SignupWizard"));
const SignupSuccess = lazy(() => import("./pages/SignupSuccess"));
const SignupCancel = lazy(() => import("./pages/SignupCancel"));

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Wrapper to check if user has a company or is platform admin
function CompanyCheck({ children }: { children: React.ReactNode }) {
  const { userCompanies, loading, currentCompany } = useCompany();
  const { isPlatformAdmin, isLoading: isLoadingAdmin } = usePlatformAdmin();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [pendingCheck, setPendingCheck] = useState(true); // NEW: block UI/redirect until timeout

useEffect(() => {
    if (!loading && !isLoadingAdmin && !isPlatformAdmin) {
      const t = setTimeout(() => {
        setShouldRedirect(userCompanies.length === 0);
        setPendingCheck(false); // unblock after 3s
      }, 3000); // 3 segundos
      return () => clearTimeout(t);
    }
  }, [loading, isLoadingAdmin, isPlatformAdmin, userCompanies]);

  if (loading || isLoadingAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  // Platform admins bypass company check and go to platform admin
  if (isPlatformAdmin) {
    return <Navigate to="/admin/platform" replace />;
  }

  if (shouldRedirect) {
    return <Navigate to="/signup" replace />;
  }

  if (!currentCompany) {
    return <div className="flex items-center justify-center min-h-screen">Sin empresa seleccionada...</div>;
  }

  return <>{children}</>;
}

// Protected route that only checks authentication (no company check)
function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { isPlatformAdmin, isLoading: isLoadingAdmin } = usePlatformAdmin();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading || isLoadingAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  // Platform admins bypass company setup and go to platform admin
  if (isPlatformAdmin) {
    return <Navigate to="/admin/platform" replace />;
  }

  return <>{children}</>;
}

// Route specifically for platform admins - only checks auth and admin status
function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  // No redirect here - just render the children (PlatformAdmin will handle admin check)
  return <>{children}</>;
}

// Protected route with both authentication and company checks
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return <CompanyCheck>{children}</CompanyCheck>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CompanyProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            <Route path="/signup" element={<SignupWizard />} />
            <Route path="/signup/success" element={<SignupSuccess />} />
            <Route path="/signup/cancel" element={<SignupCancel />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/set-password/:token" element={<SetPasswordToken />} />
            <Route path="/module-not-available" element={<ProtectedRoute><ModuleNotAvailable /></ProtectedRoute>} />
            {/* Módulos Base - siempre disponibles */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="pos"><POS /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="products"><Products /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="customers"><Customers /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="sales"><Sales /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/email" element={<ProtectedRoute><EmailConfig /></ProtectedRoute>} />
            
            {/* Módulos Adicionales - requieren contrato */}
            <Route path="/quotations" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="quotations"><Quotations /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/delivery-notes" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="delivery_notes"><DeliveryNotes /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/returns" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="returns"><Returns /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/reservations" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="reservations"><Reservations /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/customer-account" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="accounts_receivable"><CustomerAccount /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/accounts-receivable" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="accounts_receivable"><AccountsReceivable /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/promotions" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="promotions"><Promotions /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* Inventario & Compras */}
            <Route path="/suppliers" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="suppliers"><Suppliers /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="purchases"><Purchases /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="purchases"><PurchaseOrders /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/purchase-reception" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="purchases"><PurchaseReception /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/purchase-returns" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="purchases"><PurchaseReturns /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/warehouses" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="warehouses"><Warehouses /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/warehouse-stock" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="warehouse_stock"><WarehouseStock /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/warehouse-transfers" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="warehouse_transfers"><WarehouseTransfers /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/stock-reservations" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="stock_reservations"><StockReservations /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/inventory-alerts" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="inventory_alerts"><InventoryAlerts /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* Gestión */}
            <Route path="/technical-services" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="technical_services"><TechnicalServices /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="employees"><Employees /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/cash-register" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="cash_register"><CashRegister /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/checks" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="checks"><Checks /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="expenses"><Expenses /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/commissions" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="commissions"><Commissions /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* Tesorería */}
            <Route path="/bank-accounts" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="bank_accounts"><BankAccounts /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/bank-movements" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="bank_movements"><BankMovements /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/card-movements" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="card_movements"><CardMovements /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/retentions" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="retentions"><Retentions /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* Reportes & Admin */}
            <Route path="/reports" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="reports"><Reports /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/monthly-closing" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="monthly_closing"><MonthlyClosing /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/accountant-reports" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="accountant_reports"><AccountantReports /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="audit_logs"><AuditLogs /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/access-logs" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="access_logs"><AccessLogs /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/bulk-operations" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="bulk_operations"><BulkOperations /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* AFIP & Facturación */}
            <Route path="/afip" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="afip"><AFIPBilling /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/pos-points" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="pos_afip"><POSPoints /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* RRHH */}
            <Route path="/payroll" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="payroll"><Payroll /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* Integraciones */}
            <Route path="/integrations" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="integrations"><Integrations /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* AI */}
            <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
            
            {/* Atención al Cliente */}
            <Route path="/customer-support" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="customer_support"><CustomerSupport /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/customer-support/settings" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="customer_support"><CustomerSupportSettings /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/customer-support/knowledge-base" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="customer_support"><KnowledgeBase /></ModuleProtectedRoute></ProtectedRoute>} />
            
            {/* Soporte de Plataforma - siempre disponible para empresas */}
            <Route path="/platform-support" element={<ProtectedRoute><PlatformSupport /></ProtectedRoute>} />
            
            {/* Notificaciones - siempre disponible */}
            <Route path="/notification-settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
            
            {/* Admin de Plataforma */}
            <Route path="/admin/platform" element={<PlatformAdminRoute><PlatformAdmin /></PlatformAdminRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </CompanyProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
