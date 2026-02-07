import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";
import { User, Session } from "@supabase/supabase-js";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { ModuleProtectedRoute } from "./components/ModuleProtectedRoute";
import { usePermissions } from "@/hooks/usePermissions";
import { LoadingState } from "./components/LoadingState";
import { SkipLink } from "./components/SkipLink";
// Lazy load all page components
const Landing = lazy(() => import("./pages/Landing"));
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
const MyTimeTracking = lazy(() => import("./pages/MyTimeTracking"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos - datos considerados frescos
      gcTime: 1000 * 60 * 10, // 10 minutos - mantener en caché (antes: cacheTime)
      refetchOnWindowFocus: false, // No refetch al cambiar de ventana
      refetchOnMount: false, // No refetch al montar si hay datos en caché
      refetchOnReconnect: false, // No refetch al reconectar
      retry: 1, // Solo 1 reintento en caso de error
    },
  },
});


// Loading fallback component
const PageLoader = () => <LoadingState fullScreen />;


// Landing (static) routing is handled in src/pages/Landing.tsx

// Wrapper to check if user has a company or is platform admin
function CompanyCheck({ children }: { children: React.ReactNode }) {
  const { userCompanies, loading, currentCompany, refreshCompanies } = useCompany();
  const { isPlatformAdmin, isLoading: isLoadingAdmin } = usePlatformAdmin();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [pendingCheck, setPendingCheck] = useState(true); // NEW: block UI/redirect until timeout

  // LOGS para depuración
  // useEffect(() => {
  //   console.log("[CompanyCheck] loading:", loading, "isLoadingAdmin:", isLoadingAdmin, "isPlatformAdmin:", isPlatformAdmin, "currentCompany:", currentCompany, "userCompanies:", userCompanies);
  // }, [loading, isLoadingAdmin, isPlatformAdmin, currentCompany, userCompanies]);

  useEffect(() => {
    if (!loading && !isLoadingAdmin && !isPlatformAdmin) {
      // If we already have a current company, skip waiting
      if (currentCompany) {
        setPendingCheck(false);
        setShouldRedirect(false);
        return;
      }

      // Grace period: poll for companies before deciding
      setPendingCheck(true);
      let signedTsStr: string | null = null;
      try { signedTsStr = localStorage.getItem("just_signed_in_at"); } catch {}
      const recentLogin = signedTsStr ? (Date.now() - Number(signedTsStr)) < 15000 : false;
      const maxWait = recentLogin ? 15000 : 8000;
      const start = Date.now();
      const interval = setInterval(async () => {
        try { await refreshCompanies(); } catch {}

        // If companies appear, stop waiting and do NOT redirect
        if (userCompanies.length > 0) {
          setShouldRedirect(false);
          setPendingCheck(false);
          clearInterval(interval);
          // Clear recent login flag once we have companies
          if (recentLogin) { try { localStorage.removeItem("just_signed_in_at"); } catch {} }
          return;
        }

        // If after maxWait there are still no companies, redirect to signup
        if (Date.now() - start >= maxWait) {
          setShouldRedirect(true);
          setPendingCheck(false);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [loading, isLoadingAdmin, isPlatformAdmin, userCompanies, refreshCompanies, currentCompany]);

  // During the wait, keep showing loader unless we already have a current company
  if (loading || isLoadingAdmin || (pendingCheck && !currentCompany)) {
    return <LoadingState fullScreen message="Cargando empresa..." />;
  }

  // La redirección de admin ahora se maneja en ProtectedRoute

  if (shouldRedirect) {
    return <Navigate to="/signup" replace />;
  }

  // If companies exist but currentCompany hasn't been set yet, keep loading instead of showing the empty state
  if (!currentCompany && userCompanies.length > 0) {
    return <LoadingState fullScreen message="Seleccionando empresa..." />;
  }

  if (!currentCompany) {
    return <LoadingState fullScreen message="Configurando acceso..." />;
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
    return <LoadingState fullScreen />;
  }

  if (!user) {
    if (import.meta.env.DEV) console.warn("No hay usuario autenticado. Redirigiendo a login.");
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg text-destructive font-bold mb-4">No hay sesión activa. Por favor inicia sesión.</p>
        <Navigate to="/auth" />
      </div>
    );
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
    return <LoadingState fullScreen />;
  }

  if (!user) {
    if (import.meta.env.DEV) console.warn("No hay usuario autenticado (admin route). Redirigiendo a login.");
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg text-destructive font-bold mb-4">No hay sesión activa. Por favor inicia sesión.</p>
        <Navigate to="/auth" />
      </div>
    );
  }

  // No redirect here - just render the children (PlatformAdmin will handle admin check)
  return <>{children}</>;
}

// Protected route with both authentication and company checks
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { isPlatformAdmin } = usePlatformAdmin();
  const { isAdmin } = usePermissions();

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
    return <LoadingState fullScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  // Si es platform_admin y NO es admin de empresa, redirige a /admin/platform
  if (isPlatformAdmin && !isAdmin) {
    // console.log("[ProtectedRoute] Redirigiendo a /admin/platform por isPlatformAdmin");
    return <Navigate to="/admin/platform" replace />;
  }

  // Si es admin de empresa (aunque sea platform_admin), entra a /app
  return <CompanyCheck>{children}</CompanyCheck>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CompanyProvider>
          <SkipLink />
          <Suspense fallback={<PageLoader />}>
            <Routes>
            <Route path="/signup" element={<SignupWizard />} />
            <Route path="/signup/success" element={<SignupSuccess />} />
            <Route path="/signup/cancel" element={<SignupCancel />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/set-password/:token" element={<SetPasswordToken />} />
            <Route path="/module-not-available" element={<ProtectedRoute><ModuleNotAvailable /></ProtectedRoute>} />
            {/* Mostrar landing solo en la raíz */}
            <Route path="/" element={<Landing />} />

            {/* Dashboard privado en /app */}
            <Route path="/app" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="dashboard"><Dashboard /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="pos"><POS /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="products"><Products /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="customers"><Customers /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="sales"><Sales /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="settings"><Settings /></ModuleProtectedRoute></ProtectedRoute>} />
            <Route path="/settings/email" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="settings"><EmailConfig /></ModuleProtectedRoute></ProtectedRoute>} />
            
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
            <Route path="/my-time-tracking" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="employees"><MyTimeTracking /></ModuleProtectedRoute></ProtectedRoute>} />
            
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
            <Route path="/notification-settings" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="notifications"><NotificationSettings /></ModuleProtectedRoute></ProtectedRoute>} />
            
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
