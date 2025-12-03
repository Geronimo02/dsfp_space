import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";
import { User, Session } from "@supabase/supabase-js";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import Customers from "./pages/Customers";
import Sales from "./pages/Sales";
import TechnicalServices from "./pages/TechnicalServices";
import Employees from "./pages/Employees";
import CashRegister from "./pages/CashRegister";
import Purchases from "./pages/Purchases";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AuditLogs from "./pages/AuditLogs";
import AccessLogs from "./pages/AccessLogs";
import Quotations from "./pages/Quotations";
import DeliveryNotes from "./pages/DeliveryNotes";
import CustomerAccount from "./pages/CustomerAccount";
import Promotions from "./pages/Promotions";
import Returns from "./pages/Returns";
import InventoryAlerts from "./pages/InventoryAlerts";
import Reservations from "./pages/Reservations";
import Expenses from "./pages/Expenses";
import BulkOperations from "./pages/BulkOperations";
import Warehouses from "./pages/Warehouses";
import WarehouseStock from "./pages/WarehouseStock";
import WarehouseTransfers from "./pages/WarehouseTransfers";
import CompanySetup from "./pages/CompanySetup";
import ResetPassword from "./pages/ResetPassword";
import POSPoints from "./pages/POSPoints";
import NotificationSettings from "./pages/NotificationSettings";
import Checks from "./pages/Checks";
import MonthlyClosing from "./pages/MonthlyClosing";
import AccountantReports from "./pages/AccountantReports";
import AIAssistantPage from "./pages/AIAssistantPage";
import Commissions from "./pages/Commissions";
import StockReservations from "./pages/StockReservations";
import BankAccounts from "./pages/BankAccounts";
import BankMovements from "./pages/BankMovements";
import CardMovements from "./pages/CardMovements";
import Retentions from "./pages/Retentions";
import Integrations from "./pages/Integrations";
import Payroll from "./pages/Payroll";
import PlatformAdmin from "./pages/PlatformAdmin";
import ModuleNotAvailable from "./pages/ModuleNotAvailable";
import NotFound from "./pages/NotFound";
import { ModuleProtectedRoute } from "./components/ModuleProtectedRoute";

const queryClient = new QueryClient();

// Wrapper to check if user has a company or is platform admin
function CompanyCheck({ children }: { children: React.ReactNode }) {
  const { userCompanies, loading, currentCompany } = useCompany();
  const { isPlatformAdmin, isLoading: isLoadingAdmin } = usePlatformAdmin();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!loading && !isLoadingAdmin && !isPlatformAdmin && userCompanies.length === 0) {
      setShouldRedirect(true);
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
    return <Navigate to="/company-setup" replace />;
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
          <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/company-setup" element={<AuthOnlyRoute><CompanySetup /></AuthOnlyRoute>} />
          <Route path="/module-not-available" element={<ProtectedRoute><ModuleNotAvailable /></ProtectedRoute>} />
          {/* Módulos Base - siempre disponibles */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/pos" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="pos"><POS /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="products"><Products /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="customers"><Customers /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="sales"><Sales /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          
          {/* Módulos Adicionales - requieren contrato */}
          <Route path="/quotations" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="quotations"><Quotations /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/delivery-notes" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="delivery_notes"><DeliveryNotes /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/returns" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="returns"><Returns /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/reservations" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="reservations"><Reservations /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/customer-account" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="accounts_receivable"><CustomerAccount /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/promotions" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="promotions"><Promotions /></ModuleProtectedRoute></ProtectedRoute>} />
          
          {/* Inventario & Compras */}
          <Route path="/suppliers" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="suppliers"><Suppliers /></ModuleProtectedRoute></ProtectedRoute>} />
          <Route path="/purchases" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="purchases"><Purchases /></ModuleProtectedRoute></ProtectedRoute>} />
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
          <Route path="/pos-points" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="afip_pos_points"><POSPoints /></ModuleProtectedRoute></ProtectedRoute>} />
          
          {/* RRHH */}
          <Route path="/payroll" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="payroll"><Payroll /></ModuleProtectedRoute></ProtectedRoute>} />
          
          {/* Integraciones */}
          <Route path="/integrations" element={<ProtectedRoute><ModuleProtectedRoute moduleCode="integrations"><Integrations /></ModuleProtectedRoute></ProtectedRoute>} />
          
          {/* AI */}
          <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
          
          {/* Notificaciones - siempre disponible */}
          <Route path="/notification-settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
           <Route path="/admin/platform" element={<PlatformAdminRoute><PlatformAdmin /></PlatformAdminRoute>} />
           <Route path="/ai-assistant" element={<ProtectedRoute><AIAssistantPage /></ProtectedRoute>} />
           <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
           {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
           <Route path="*" element={<NotFound />} />
        </Routes>
        </CompanyProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
