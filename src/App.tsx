import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProvider, useCompany } from "@/contexts/CompanyContext";
import { User, Session } from "@supabase/supabase-js";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrapper to check if user has a company
function CompanyCheck({ children }: { children: React.ReactNode }) {
  const { userCompanies, loading, currentCompany } = useCompany();
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (!loading && userCompanies.length === 0) {
      setShouldRedirect(true);
    }
  }, [loading, userCompanies]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando empresa...</div>;
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
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
          <Route path="/quotations" element={<ProtectedRoute><Quotations /></ProtectedRoute>} />
          <Route path="/delivery-notes" element={<ProtectedRoute><DeliveryNotes /></ProtectedRoute>} />
          <Route path="/customer-account" element={<ProtectedRoute><CustomerAccount /></ProtectedRoute>} />
          <Route path="/promotions" element={<ProtectedRoute><Promotions /></ProtectedRoute>} />
          <Route path="/returns" element={<ProtectedRoute><Returns /></ProtectedRoute>} />
          <Route path="/reservations" element={<ProtectedRoute><Reservations /></ProtectedRoute>} />
          <Route path="/technical-services" element={<ProtectedRoute><TechnicalServices /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
          <Route path="/cash-register" element={<ProtectedRoute><CashRegister /></ProtectedRoute>} />
          <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          <Route path="/access-logs" element={<ProtectedRoute><AccessLogs /></ProtectedRoute>} />
          <Route path="/inventory-alerts" element={<ProtectedRoute><InventoryAlerts /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/bulk-operations" element={<ProtectedRoute><BulkOperations /></ProtectedRoute>} />
          <Route path="/warehouses" element={<ProtectedRoute><Warehouses /></ProtectedRoute>} />
           <Route path="/warehouse-stock" element={<ProtectedRoute><WarehouseStock /></ProtectedRoute>} />
           <Route path="/warehouse-transfers" element={<ProtectedRoute><WarehouseTransfers /></ProtectedRoute>} />
           <Route path="/stock-reservations" element={<ProtectedRoute><StockReservations /></ProtectedRoute>} />
           <Route path="/pos-points" element={<ProtectedRoute><POSPoints /></ProtectedRoute>} />
           <Route path="/notification-settings" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
           <Route path="/checks" element={<ProtectedRoute><Checks /></ProtectedRoute>} />
           <Route path="/monthly-closing" element={<ProtectedRoute><MonthlyClosing /></ProtectedRoute>} />
           <Route path="/accountant-reports" element={<ProtectedRoute><AccountantReports /></ProtectedRoute>} />
           <Route path="/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />
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
