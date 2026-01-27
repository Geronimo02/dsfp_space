import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  LogOut, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle2,
  Bell,
  MessageSquare,
  Clock,
  Search,
  Plus,
  FileText,
  BarChart3,
  Settings,
  Download,
  Edit,
  Trash,
  Ticket,
  Plug,
  Activity,
  XCircle,
  Rocket,
  Circle,
  Calculator,
  Package
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { exportToExcel, exportToPDF, formatCurrency, formatDate } from "@/lib/exportUtils";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { usePlatformAdminRealtime } from "@/hooks/usePlatformAdminRealtime";
import { useNavigate, Navigate } from "react-router-dom";
import { PricingConfiguration } from "@/components/settings/PricingConfiguration";
import { PricingCalculator } from "@/components/settings/PricingCalculator";
import { CompanyModuleSelector } from "@/components/settings/CompanyModuleSelector";
import { CustomPricingManager } from "@/components/settings/CustomPricingManager";
import { ModuleLimitsManager } from "@/components/settings/ModuleLimitsManager";
import { ModuleAuditLog } from "@/components/settings/ModuleAuditLog";
import { PlatformAdminHeader, PlatformAdminNav, PlatformAdminDashboard } from "@/components/platformAdmin";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/hooks/usePagination";

export default function PlatformAdmin() {
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Enable realtime for platform admin to receive new tickets and messages
  usePlatformAdminRealtime({
    enabled: isPlatformAdmin,
    onTicketUpdate: (updatedTicket: any) => {
      // Update the selected ticket if it's the one being viewed
      if (updatedTicket.id === selectedPlatformTicket?.id) {
        setSelectedPlatformTicket(updatedTicket);
      }
    },
  });
  
  // State for filters and dialogs
  const [companySearch, setCompanySearch] = useState("");
  const [companyStatusFilter, setCompanyStatusFilter] = useState<string>("all");
  const [notificationFilter, setNotificationFilter] = useState<string>("all");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [auditLogSearch, setAuditLogSearch] = useState("");
  const [auditLogActionFilter, setAuditLogActionFilter] = useState<string>("all");
  const [userSearch, setUserSearch] = useState("");
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [platformSupportStatusFilter, setPlatformSupportStatusFilter] = useState<string>("active");
  const [integrationStatusFilter, setIntegrationStatusFilter] = useState<string>("all");
  const [newPayment, setNewPayment] = useState({
    company_id: "",
    amount: "",
    payment_method: "",
    notes: "",
    status: "pending"
  });
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: "",
    billing_period: "monthly",
    max_users: "",
    features: ""
  });
  const [modulesDialogOpen, setModulesDialogOpen] = useState(false);
  const [selectedCompanyForModules, setSelectedCompanyForModules] = useState<any>(null);
  const [customPricingDialogOpen, setCustomPricingDialogOpen] = useState(false);
  const [selectedCompanyForPricing, setSelectedCompanyForPricing] = useState<any>(null);

  // Fetch all companies with their subscriptions (must be before any conditional returns)
  const { data: companies, isLoading, error: companiesError } = useQuery({
    queryKey: ["platform-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          subscriptions (
            *,
            subscription_plans (*)
          ),
          company_users (
            id,
            role,
            active
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch feedback
  const { data: feedbacks } = useQuery({
    queryKey: ["platform-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_feedback")
        .select(`
          *,
          companies (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch notifications
  const { data: notifications } = useQuery({
    queryKey: ["platform-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_notifications")
        .select(`
          *,
          companies (name)
        `)
        .order("created_at", { ascending: false})
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Fetch payments
  const { data: payments } = useQuery({
    queryKey: ["platform-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_payments")
        .select(`
          *,
          companies:company_id (name),
          subscriptions:subscription_id (status)
        `)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch audit logs from existing audit_logs table
  const { data: auditLogs } = useQuery({
    queryKey: ["platform-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch all users
  const { data: allUsers } = useQuery({
    queryKey: ["platform-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_users")
        .select(`
          *,
          companies (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch subscription plans
  const { data: subscriptionPlans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch revenue analytics
  const { data: revenueAnalytics } = useQuery({
    queryKey: ["platform-revenue-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_payments")
        .select("amount, payment_date, status")
        .eq("status", "paid")
        .order("payment_date", { ascending: true });

      if (error) throw error;
      
      // Group by month
      const monthlyRevenue: Record<string, number> = {};
      data?.forEach((payment) => {
        const month = new Date(payment.payment_date).toLocaleDateString('es-AR', { year: 'numeric', month: 'short' });
        monthlyRevenue[month] = (monthlyRevenue[month] || 0) + payment.amount;
      });

      return Object.entries(monthlyRevenue).map(([month, revenue]) => ({
        month,
        revenue
      }));
    },
  });

  // Fetch usage metrics per company
  const { data: usageMetrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['platform-usage-metrics'],
    queryFn: async () => {
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .eq('active', true);
      
      if (!companies) return [];
      
      const metrics = await Promise.all(companies.map(async (company) => {
        // Get sales count for current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { count: salesCount } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .gte('created_at', startOfMonth.toISOString());
        
        // Get active products count
        const { count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('active', true);
        
        // Get active users count
        const { count: usersCount } = await supabase
          .from('company_users')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('active', true);
        
        // Get sales from last month for growth calculation
        const lastMonthStart = new Date(startOfMonth);
        lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
        
        const { count: lastMonthSales } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .gte('created_at', lastMonthStart.toISOString())
          .lt('created_at', startOfMonth.toISOString());
        
        const growth = lastMonthSales && lastMonthSales > 0
          ? ((salesCount || 0) - lastMonthSales) / lastMonthSales * 100
          : 0;
        
        return {
          company_id: company.id,
          company_name: company.name,
          sales_this_month: salesCount || 0,
          active_products: productsCount || 0,
          active_users: usersCount || 0,
          growth_percentage: growth
        };
      }));
      
      return metrics;
    }
  });

  // Fetch support tickets (sistema antiguo)
  // Fetch customer support tickets (nuevo sistema integrado)
  // Estados para gestión de tickets de plataforma
  const [selectedPlatformTicket, setSelectedPlatformTicket] = useState<any>(null);
  const [platformTicketMessage, setPlatformTicketMessage] = useState("");

  // Tickets de soporte de PLATAFORMA (empresas reportando problemas a admins)
  const { data: platformSupportTickets, isLoading: platformTicketsLoading, error: platformTicketsError, refetch: refetchTickets } = useQuery({
    queryKey: ["platform-support-tickets"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("platform_support_tickets")
          .select(`
            *,
            companies!platform_support_tickets_company_id_fkey (
              name,
              email,
              phone,
              whatsapp_number
            )
          `)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching platform support tickets:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error("Exception fetching tickets:", err);
        return [];
      }
    },
    retry: 1,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });

  // Mensajes del ticket seleccionado
  const { data: platformTicketMessages } = useQuery({
    queryKey: ["platform-ticket-messages", selectedPlatformTicket?.id],
    queryFn: async () => {
      if (!selectedPlatformTicket?.id) return [];
      const { data, error } = await supabase
        .from("platform_support_messages")
        .select("*")
        .eq("ticket_id", selectedPlatformTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPlatformTicket?.id,
  });

  // Mutation para responder ticket
  const respondPlatformTicketMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlatformTicket?.id || !platformTicketMessage.trim()) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error } = await supabase
        .from("platform_support_messages")
        .insert([{
          ticket_id: selectedPlatformTicket.id,
          sender_type: "admin",
          sender_id: user.id,
          message: platformTicketMessage,
        }]);

      if (error) throw error;

      // Retornar info para enviar notificación a la empresa
      return {
        ticketId: selectedPlatformTicket.id,
        ticketNumber: selectedPlatformTicket.ticket_number,
        companyId: selectedPlatformTicket.company_id,
        companyEmail: selectedPlatformTicket.companies?.email,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["platform-ticket-messages"] });
      setPlatformTicketMessage("");
      
      // Enviar notificación a la empresa (opcional - solo si hay email)
      if (data?.companyEmail) {
        supabase.functions.invoke("notify-platform-support-ticket", {
          body: {
            ticket_id: data.ticketId,
            type: "message_received",
            send_email: true,
            send_sms: false,
          }
        }).catch(() => {});
      }
      
      toast.success("Respuesta enviada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar respuesta");
    },
  });

  // Mutation para cambiar estado del ticket
  const updatePlatformTicketStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string, status: string }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === "resolved") updates.resolved_at = new Date().toISOString();
      if (status === "closed") updates.closed_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("platform_support_tickets")
        .update(updates)
        .eq("id", ticketId)
        .select(`
          *,
          companies!platform_support_tickets_company_id_fkey (
            name,
            email,
            phone,
            whatsapp_number
          )
        `)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("No se pudo actualizar el ticket");
      return data;
    },
    onSuccess: (updatedTicket) => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ 
        queryKey: ["platform-support-tickets"],
        refetchType: 'all'
      });
      // Actualizar el ticket seleccionado con datos frescos de BD
      if (selectedPlatformTicket && selectedPlatformTicket.id === updatedTicket.id) {
        setSelectedPlatformTicket(updatedTicket);
        // Si se cierra, deselecciona después de 1 segundo
        if (updatedTicket.status === "closed") {
          setTimeout(() => setSelectedPlatformTicket(null), 1000);
        }
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar el estado del ticket");
    },
  });

  // Fetch integrations data
  const { data: integrationsData } = useQuery({
    queryKey: ["platform-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select(`
          *,
          companies (name)
        `)
        .order("created_at", { ascending: false});

      if (error) throw error;
      return data;
    },
  });

  // Fetch AFIP status per company
  const { data: afipData } = useQuery({
    queryKey: ["platform-afip-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_afip")
        .select(`
          *,
          companies (name)
        `);

      if (error) throw error;
      return data;
    },
  });

  // Fetch integration logs
  const { data: integrationLogs } = useQuery({
    queryKey: ["platform-integration-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_logs")
        .select(`
          *,
          companies (name),
          integrations (name, integration_type)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  // Fetch company onboarding data
  const { data: onboardingData } = useQuery({
    queryKey: ["platform-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_onboarding")
        .select(`
          *,
          companies (name, active, created_at)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const activeCompanies = companies?.filter(c => c.active)?.length || 0;
      const unreadNotifications = notifications?.filter(n => !n.read)?.length || 0;
      const pendingFeedback = feedbacks?.filter(f => f.status === "pending")?.length || 0;
      
      const totalRevenue = payments?.reduce((sum, p) => {
        if (p.status === "paid" || p.status === "completed") return sum + Number(p.amount);
        return sum;
      }, 0) || 0;
      
      const pendingRevenue = payments?.reduce((sum, p) => {
        if (p.status === "pending") return sum + Number(p.amount);
        return sum;
      }, 0) || 0;
      
      return {
        totalCompanies: companies?.length || 0,
        activeCompanies,
        unreadNotifications,
        pendingFeedback,
        totalRevenue,
        pendingRevenue
      };
    },
    enabled: !!companies && !!notifications && !!feedbacks && !!payments,
  });

  // Toggle company active status
  const toggleCompanyMutation = useMutation({
    mutationFn: async ({ companyId, active }: { companyId: string; active: boolean }) => {
      const { error } = await supabase
        .from("companies")
        .update({ active })
        .eq("id", companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast.success("Estado de la empresa actualizado");
    },
    onError: () => {
      toast.error("Error al actualizar el estado");
    },
  });

  // Mark notification as read
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("platform_notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast.success("Notificación marcada como leída");
    },
    onError: (error) => {
      toast.error("Error al marcar notificación");
      console.error("Error:", error);
    },
  });

  // Update feedback status
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ 
      feedbackId, 
      status, 
      adminNotes 
    }: { 
      feedbackId: string; 
      status: string; 
      adminNotes?: string 
    }) => {
      const updates: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (adminNotes !== undefined) {
        updates.admin_notes = adminNotes;
      }

      const { error } = await supabase
        .from("platform_feedback")
        .update(updates)
        .eq("id", feedbackId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast.success("Feedback actualizado");
    },
    onError: (error) => {
      toast.error("Error al actualizar feedback");
      console.error("Error:", error);
    },
  });

  // Update payment status
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ 
      paymentId, 
      status, 
      transactionId,
      notes
    }: { 
      paymentId: string; 
      status: string;
      transactionId?: string;
      notes?: string;
    }) => {
      const updates: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (transactionId) updates.transaction_id = transactionId;
      if (notes !== undefined) updates.notes = notes;

      const { error } = await supabase
        .from("platform_payments")
        .update(updates)
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-payments"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      toast.success("Pago actualizado");
    },
    onError: (error) => {
      toast.error("Error al actualizar pago");
      console.error("Error:", error);
    },
  });

  // Create payment
  const createPaymentMutation = useMutation({
    mutationFn: async (payment: typeof newPayment) => {
      const { error } = await supabase
        .from("platform_payments")
        .insert({
          company_id: payment.company_id,
          amount: Number(payment.amount),
          payment_method: payment.payment_method,
          notes: payment.notes,
          status: payment.status,
          payment_date: new Date().toISOString(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-payments"] });
      queryClient.invalidateQueries({ queryKey: ["platform-stats"] });
      setIsPaymentDialogOpen(false);
      setNewPayment({
        company_id: "",
        amount: "",
        payment_method: "",
        notes: "",
        status: "pending"
      });
      toast.success("Pago registrado exitosamente");
    },
    onError: (error) => {
      toast.error("Error al registrar el pago: " + error.message);
    },
  });

  // Create ticket

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    } else {
      navigate("/auth");
      toast.success("Sesión cerrada exitosamente");
    }
  };

  // Helper functions
  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      paid: { variant: "default", label: "Pagado" },
      completed: { variant: "default", label: "Completado" },
      pending: { variant: "secondary", label: "Pendiente" },
      overdue: { variant: "destructive", label: "Vencido" },
      cancelled: { variant: "outline", label: "Cancelado" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      critical: "destructive",
      warning: "secondary",
      info: "default",
    };
    return <Badge variant={variants[severity] || "default"}>{severity}</Badge>;
  };

  const getFeedbackCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      bug: "bg-red-500/10 text-red-500",
      feature: "bg-blue-500/10 text-blue-500",
      improvement: "bg-green-500/10 text-green-500",
      question: "bg-yellow-500/10 text-yellow-500",
    };
    return <Badge className={colors[category] || ""}>{category}</Badge>;
  };

  const getStatusBadge = (active: boolean) => {
    return active ? (
      <Badge variant="default">Activa</Badge>
    ) : (
      <Badge variant="destructive">Inactiva</Badge>
    );
  };

  const getSubscriptionStatus = (subscription: any) => {
    if (!subscription || subscription.length === 0) {
      return <Badge variant="secondary">Sin suscripción</Badge>;
    }

    const status = subscription[0].status;
    const labels: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Activa" },
      trial: { variant: "outline", label: "Prueba" },
      suspended: { variant: "destructive", label: "Suspendida" },
      cancelled: { variant: "secondary", label: "Cancelada" },
    };

    const config = labels[status] || labels.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Filtered data
  const filteredCompanies = companies?.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(companySearch.toLowerCase());
    const matchesStatus = companyStatusFilter === "all" || 
      (companyStatusFilter === "active" && company.active) ||
      (companyStatusFilter === "inactive" && !company.active);
    return matchesSearch && matchesStatus;
  });

  const filteredNotifications = notifications?.filter(notification => {
    if (notificationFilter === "all") return true;
    if (notificationFilter === "unread") return !notification.read;
    return notification.notification_type === notificationFilter;
  });

  const filteredFeedback = feedbacks?.filter(f => {
    if (feedbackStatusFilter === "all") return true;
    return f.status === feedbackStatusFilter;
  });

  const filteredPayments = payments?.filter(payment => {
    if (paymentStatusFilter === "all") return true;
    return payment.status === paymentStatusFilter;
  });

  const filteredAuditLogs = auditLogs?.filter(log => {
    const matchesSearch = !auditLogSearch || 
      log.user_email?.toLowerCase().includes(auditLogSearch.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(auditLogSearch.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(auditLogSearch.toLowerCase());
    
    const matchesAction = auditLogActionFilter === "all" || log.action === auditLogActionFilter;
    
    return matchesSearch && matchesAction;
  });

  // Pagination hooks
  const companiesPagination = usePagination(filteredCompanies, { initialPageSize: 10 });
  const notificationsPagination = usePagination(filteredNotifications, { initialPageSize: 10 });
  const feedbackPagination = usePagination(filteredFeedback, { initialPageSize: 10 });
  const paymentsPagination = usePagination(filteredPayments, { initialPageSize: 10 });
  const auditLogsPagination = usePagination(filteredAuditLogs, { initialPageSize: 20 });
  const usersPagination = usePagination(allUsers?.filter(u => 
    u.companies?.name?.toLowerCase().includes(userSearch.toLowerCase())
  ), { initialPageSize: 10 });

  // Show loading while checking admin status
  if (adminLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Redirect if not platform admin
  if (!isPlatformAdmin) {
    return <Navigate to="/app" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando panel administrativo...</p>
        </div>
      </div>
    );
  }

  if (companiesError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-destructive">
          <p className="text-xl font-bold mb-2">Error al cargar empresas</p>
          <p>{companiesError.message}</p>
        </div>
      </div>
    );
  }

  const totalUsers = companies?.reduce((acc, c) => acc + (c.company_users?.filter((u: any) => u.active).length || 0), 0) || 0;
  const overduePayments = companies?.filter(c => {
    const sub = c.subscriptions?.[0];
    return sub && sub.next_payment_date && new Date(sub.next_payment_date) < new Date();
  }).length || 0;

  return (
    <div className="min-h-screen bg-background">
      <PlatformAdminHeader onLogout={handleLogout} />

      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
          <p className="text-muted-foreground">
            Gestión completa de empresas, notificaciones, feedback y pagos
          </p>
        </div>

        <PlatformAdminDashboard 
          stats={stats} 
          revenueData={revenueAnalytics}
          ticketStats={{
            open: platformSupportTickets?.filter((t: any) => t.status === 'open').length || 0,
            inProgress: platformSupportTickets?.filter((t: any) => t.status === 'in_progress').length || 0,
            resolved: platformSupportTickets?.filter((t: any) => t.status === 'resolved').length || 0,
            slaBreach: platformSupportTickets?.filter((t: any) => t.sla_response_breached || t.sla_resolution_breached).length || 0,
          }}
          companiesGrowth={0}
          usersCount={totalUsers}
          overduePayments={overduePayments}
        />

        <Tabs defaultValue="companies" className="flex gap-6">
          <PlatformAdminNav 
            openTicketsCount={platformSupportTickets?.filter((t: any) => t.status === 'open').length || 0}
            unreadNotificationsCount={stats?.unreadNotifications || 0}
          />

          <div className="flex-1 min-w-0">

          {/* Pricing Configuration Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <PricingConfiguration />
          </TabsContent>

          {/* Pricing Calculator Tab */}
          <TabsContent value="calculator" className="space-y-4">
            <PricingCalculator />
          </TabsContent>

          {/* Module Limits Manager Tab */}
          <TabsContent value="module-limits" className="space-y-4">
            <ModuleLimitsManager />
          </TabsContent>

          {/* Module Audit Log Tab */}
          <TabsContent value="module-audit" className="space-y-4">
            <ModuleAuditLog />
          </TabsContent>

          {/* Usage Metrics Tab */}
          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Métricas de Uso por Empresa</CardTitle>
                    <CardDescription>
                      Estadísticas de actividad y crecimiento de cada empresa
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      if (!usageMetrics) return;
                      exportToExcel(
                        usageMetrics.map(m => ({
                          'Empresa': m.company_name,
                          'Ventas este mes': m.sales_this_month,
                          'Productos activos': m.active_products,
                          'Usuarios activos': m.active_users,
                          'Crecimiento (%)': m.growth_percentage.toFixed(1)
                        })),
                        'metricas-uso-empresas'
                      );
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresa..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingMetrics ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="text-right">Ventas este mes</TableHead>
                        <TableHead className="text-right">Productos activos</TableHead>
                        <TableHead className="text-right">Usuarios activos</TableHead>
                        <TableHead className="text-right">Crecimiento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageMetrics && usageMetrics.length > 0 ? (
                        usageMetrics
                          .filter(metric => 
                            metric.company_name.toLowerCase().includes(companySearch.toLowerCase())
                          )
                          .map((metric) => (
                            <TableRow key={metric.company_id}>
                              <TableCell className="font-medium">
                                {metric.company_name}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary">
                                  {metric.sales_this_month}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">
                                  {metric.active_products}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">
                                  {metric.active_users}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge 
                                  variant={metric.growth_percentage >= 0 ? "default" : "destructive"}
                                >
                                  {metric.growth_percentage > 0 ? '+' : ''}
                                  {metric.growth_percentage.toFixed(1)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No hay métricas disponibles
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Platform Support Tab - Tickets de empresas a admins */}
          <TabsContent value="platform-support" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Lista de Tickets */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle>Tickets de Soporte</CardTitle>
                  <CardDescription>
                    Problemas reportados por empresas
                  </CardDescription>
                  
                  {/* Tabs para separar activos de históricos */}
                  <div className="flex gap-1 mt-4 p-1 bg-muted rounded-lg">
                    <Button 
                      variant={platformSupportStatusFilter === 'active' ? 'default' : 'ghost'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setPlatformSupportStatusFilter('active')}
                    >
                      🔥 Activos ({platformSupportTickets?.filter((t: any) => 
                        ['open', 'in_progress', 'pending'].includes(t.status)
                      ).length || 0})
                    </Button>
                    <Button 
                      variant={platformSupportStatusFilter === 'history' ? 'default' : 'ghost'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setPlatformSupportStatusFilter('history')}
                    >
                      📋 Historial ({platformSupportTickets?.filter((t: any) => 
                        ['resolved', 'closed'].includes(t.status)
                      ).length || 0})
                    </Button>
                  </div>

                  {/* Filtro adicional dentro de la pestaña activa */}
                  {platformSupportStatusFilter === 'active' && (
                    <div className="flex gap-1 mt-2">
                      <Badge 
                        variant="destructive" 
                        className="cursor-pointer hover:bg-destructive/80"
                        onClick={() => setPlatformSupportStatusFilter('open')}
                      >
                        Abiertos ({platformSupportTickets?.filter((t: any) => t.status === 'open').length || 0})
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className="cursor-pointer hover:bg-secondary/80"
                        onClick={() => setPlatformSupportStatusFilter('in_progress')}
                      >
                        En Progreso ({platformSupportTickets?.filter((t: any) => t.status === 'in_progress').length || 0})
                      </Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {/* Stats rápidos */}
                  <div className="grid grid-cols-4 gap-1 mb-4">
                    <div className="text-center p-2 bg-red-500/10 rounded">
                      <div className="text-lg font-bold text-red-600">
                        {platformSupportTickets?.filter((t: any) => t.status === 'open').length || 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Abiertos</div>
                    </div>
                    <div className="text-center p-2 bg-blue-500/10 rounded">
                      <div className="text-lg font-bold text-blue-600">
                        {platformSupportTickets?.filter((t: any) => t.status === 'in_progress').length || 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Progreso</div>
                    </div>
                    <div className="text-center p-2 bg-yellow-500/10 rounded">
                      <div className="text-lg font-bold text-yellow-600">
                        {platformSupportTickets?.filter((t: any) => t.waiting_for_customer).length || 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Esperando</div>
                    </div>
                    <div className="text-center p-2 bg-green-500/10 rounded">
                      <div className="text-lg font-bold text-green-600">
                        {platformSupportTickets?.filter((t: any) => t.status === 'resolved').length || 0}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Resueltos</div>
                    </div>
                  </div>
                  
                  {/* SLA Breaches */}
                  {(platformSupportTickets?.filter((t: any) => t.sla_response_breached || t.sla_resolution_breached).length || 0) > 0 && (
                    <div className="p-2 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {platformSupportTickets?.filter((t: any) => t.sla_response_breached || t.sla_resolution_breached).length} SLA incumplidos
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-[500px] overflow-y-auto border rounded p-2">
                    {platformSupportTickets && platformSupportTickets.length > 0 ? (
                      (() => {
                        let filtered = platformSupportTickets;
                        
                        // Filtrar según la pestaña seleccionada
                        if (platformSupportStatusFilter === 'active') {
                          filtered = filtered.filter((t: any) => ['open', 'in_progress', 'pending'].includes(t.status));
                        } else if (platformSupportStatusFilter === 'history') {
                          filtered = filtered.filter((t: any) => ['resolved', 'closed'].includes(t.status));
                        } else if (platformSupportStatusFilter === 'open') {
                          filtered = filtered.filter((t: any) => t.status === 'open');
                        } else if (platformSupportStatusFilter === 'in_progress') {
                          filtered = filtered.filter((t: any) => t.status === 'in_progress');
                        } else if (platformSupportStatusFilter !== 'all') {
                          filtered = filtered.filter((t: any) => t.status === platformSupportStatusFilter);
                        }
                        
                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              <p className="text-sm">No hay tickets en esta categoría</p>
                            </div>
                          );
                        }
                        
                        return filtered.map((ticket: any) => (
                        <div
                          key={ticket.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedPlatformTicket?.id === ticket.id ? "bg-muted border-2 border-primary" : ""
                          }`}
                          onClick={() => setSelectedPlatformTicket(ticket)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-medium">{ticket.ticket_number}</span>
                              <Badge variant={
                                ticket.status === 'open' ? 'destructive' :
                                ticket.status === 'in_progress' ? 'secondary' :
                                ticket.status === 'resolved' ? 'default' :
                                'outline'
                              } className="text-xs">
                                {ticket.status === 'open' ? 'Abierto' :
                                 ticket.status === 'in_progress' ? 'En Progreso' :
                                 ticket.status === 'resolved' ? '✓ Resuelto' : '✓ Cerrado'}
                              </Badge>
                              {ticket.waiting_for_customer && (
                                <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                  ⏳ Esperando
                                </Badge>
                              )}
                              {(ticket.sla_response_breached || ticket.sla_resolution_breached) && (
                                <Badge variant="destructive" className="text-xs">
                                  ⚠️ SLA
                                </Badge>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {ticket.priority === 'urgent' ? '🔴' :
                               ticket.priority === 'high' ? '🟠' :
                               ticket.priority === 'medium' ? '🟡' : '🟢'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {ticket.companies?.name}
                            {ticket.auto_priority_reason && (
                              <span className="ml-2 text-yellow-600">{ticket.subscription_plan === 'annual' ? '⭐' : ''}</span>
                            )}
                          </div>
                          <h4 className="font-medium text-sm line-clamp-1">{ticket.subject}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{ticket.description}</p>
                          
                          {/* Botones de acción rápida */}
                          {ticket.status !== 'closed' && (
                            <div className="flex gap-1 mt-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                              {ticket.status === 'open' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 text-xs flex-1"
                                  onClick={() => updatePlatformTicketStatusMutation.mutate({
                                    ticketId: ticket.id,
                                    status: 'in_progress'
                                  })}
                                >
                                  ▶ Tomar
                                </Button>
                              )}
                              {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 text-xs flex-1 text-green-600 hover:text-green-700"
                                  onClick={() => updatePlatformTicketStatusMutation.mutate({
                                    ticketId: ticket.id,
                                    status: 'resolved'
                                  })}
                                >
                                  ✓ Resolver
                                </Button>
                              )}
                              {ticket.status === 'resolved' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 text-xs flex-1"
                                  onClick={() => updatePlatformTicketStatusMutation.mutate({
                                    ticketId: ticket.id,
                                    status: 'closed'
                                  })}
                                >
                                  📁 Archivar
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ));
                      })()
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Ticket className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay tickets reportados</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Detalle del Ticket */}
              <Card className="lg:col-span-2">
                {selectedPlatformTicket ? (
                  <>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{selectedPlatformTicket.ticket_number}</CardTitle>
                            <Select
                              value={selectedPlatformTicket.status}
                              onValueChange={(val) => {
                                updatePlatformTicketStatusMutation.mutate({
                                  ticketId: selectedPlatformTicket.id,
                                  status: val
                                });
                              }}
                              disabled={updatePlatformTicketStatusMutation.isPending}
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Abierto</SelectItem>
                                <SelectItem value="in_progress">En Progreso</SelectItem>
                                <SelectItem value="resolved">Resuelto</SelectItem>
                                <SelectItem value="closed">Cerrado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <CardDescription>{selectedPlatformTicket.subject}</CardDescription>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedPlatformTicket(null)}
                          className="mt-1"
                        >
                          ✕ Cerrar
                        </Button>
                      </div>
                      
                      {/* Info de la Empresa */}
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Empresa:</span>
                            <div className="font-medium flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {selectedPlatformTicket.companies?.name}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Email:</span>
                            <div className="font-medium">{selectedPlatformTicket.companies?.email || 'No disponible'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Categoría:</span>
                            <div className="font-medium">
                              {selectedPlatformTicket.category === 'technical' ? '🔧 Técnico' :
                               selectedPlatformTicket.category === 'billing' ? '💰 Facturación' :
                               selectedPlatformTicket.category === 'feature_request' ? '✨ Nueva Función' :
                               selectedPlatformTicket.category === 'bug' ? '🐛 Bug' :
                               selectedPlatformTicket.category === 'account' ? '👤 Cuenta' : '📋 Otro'}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Prioridad:</span>
                            <div className="font-medium">
                              {selectedPlatformTicket.priority === 'urgent' ? '🔴 Urgente' :
                               selectedPlatformTicket.priority === 'high' ? '🟠 Alta' :
                               selectedPlatformTicket.priority === 'medium' ? '🟡 Media' : '🟢 Baja'}
                              {selectedPlatformTicket.auto_priority_reason && (
                                <span className="ml-2 text-xs text-yellow-600">
                                  ({selectedPlatformTicket.auto_priority_reason})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* SLA Info */}
                        <div className="grid grid-cols-2 gap-3 text-sm mt-3 pt-3 border-t">
                          <div>
                            <span className="text-muted-foreground">SLA Respuesta:</span>
                            <div className={`font-medium flex items-center gap-1 ${selectedPlatformTicket.sla_response_breached ? 'text-destructive' : ''}`}>
                              <Clock className="h-3 w-3" />
                              {selectedPlatformTicket.sla_response_hours || 24}h
                              {selectedPlatformTicket.first_response_at && (
                                <span className="text-green-600 ml-1">✓</span>
                              )}
                              {selectedPlatformTicket.sla_response_breached && (
                                <span className="text-destructive ml-1">⚠️</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">SLA Resolución:</span>
                            <div className={`font-medium flex items-center gap-1 ${selectedPlatformTicket.sla_resolution_breached ? 'text-destructive' : ''}`}>
                              <Clock className="h-3 w-3" />
                              {selectedPlatformTicket.sla_resolution_hours || 72}h
                              {selectedPlatformTicket.resolved_at && (
                                <span className="text-green-600 ml-1">✓</span>
                              )}
                              {selectedPlatformTicket.sla_resolution_breached && (
                                <span className="text-destructive ml-1">⚠️</span>
                              )}
                            </div>
                          </div>
                          {selectedPlatformTicket.waiting_for_customer && (
                            <div className="col-span-2">
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                ⏳ Esperando respuesta del cliente desde {new Date(selectedPlatformTicket.waiting_since).toLocaleDateString('es-AR')}
                              </Badge>
                            </div>
                          )}
                          {selectedPlatformTicket.escalated_at && (
                            <div className="col-span-2">
                              <Badge variant="destructive">
                                🔺 Escalado: {selectedPlatformTicket.escalated_to || 'Supervisor'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Descripción Original */}
                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="text-sm font-medium mb-2">Descripción del Problema:</h4>
                        <p className="text-sm">{selectedPlatformTicket.description}</p>
                      </div>

                      {/* Mensajes */}
                      <div className="space-y-3 max-h-[300px] overflow-y-auto border rounded-lg p-3">
                        {platformTicketMessages && platformTicketMessages.length > 0 ? (
                          platformTicketMessages.map((msg: any) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] p-3 rounded-lg ${
                                  msg.sender_type === 'admin'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                
                                {/* Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {msg.attachments.map((att: any, idx: number) => (
                                      <a
                                        key={idx}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 text-xs p-2 rounded ${
                                          msg.sender_type === 'admin'
                                            ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20'
                                            : 'bg-background hover:bg-accent'
                                        }`}
                                      >
                                        {att.type?.startsWith('image/') ? (
                                          <img 
                                            src={att.url} 
                                            alt={att.name} 
                                            className="max-w-[150px] max-h-[100px] rounded object-cover"
                                          />
                                        ) : (
                                          <>
                                            <FileText className="h-3 w-3" />
                                            <span className="truncate max-w-[150px]">{att.name}</span>
                                          </>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                
                                <p className="text-xs opacity-70 mt-1">
                                  {new Date(msg.created_at).toLocaleString('es-AR')}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No hay mensajes todavía
                          </p>
                        )}
                      </div>

                      {/* Responder */}
                      {selectedPlatformTicket.status !== 'closed' && (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                          <Label>Responder a la Empresa</Label>
                          <Textarea
                            placeholder="Escribe tu respuesta..."
                            value={platformTicketMessage}
                            onChange={(e) => setPlatformTicketMessage(e.target.value)}
                            className="min-h-[100px]"
                          />
                          
                          {/* Botones de envío */}
                          <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                onClick={() => respondPlatformTicketMutation.mutate()}
                                disabled={!platformTicketMessage.trim()}
                                className="col-span-1"
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Enviar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const email = selectedPlatformTicket.companies?.email;
                                  if (!email) {
                                    toast.error("Esta empresa no tiene email registrado");
                                    return;
                                  }
                                  const subject = `RE: Ticket ${selectedPlatformTicket.ticket_number} - ${selectedPlatformTicket.subject}`;
                                  const body = `${platformTicketMessage}\n\n---\nTicket: ${selectedPlatformTicket.ticket_number}`;
                                  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                  window.open(gmailUrl, '_blank');
                                  toast.success("Gmail abierto");
                                }}
                                disabled={!platformTicketMessage.trim()}
                              >
                                📧
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const phone = selectedPlatformTicket.companies?.whatsapp_number || selectedPlatformTicket.companies?.phone;
                                  if (!phone) {
                                    toast.error("Esta empresa no tiene número de teléfono registrado");
                                    return;
                                  }
                                  // Limpiar el número para WhatsApp (solo dígitos en formato internacional)
                                  const cleanPhone = phone.replace(/\D/g, "");
                                  const message = `${platformTicketMessage}\n\nTicket: ${selectedPlatformTicket.ticket_number}`;
                                  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                                  window.open(waUrl, "_blank", "noopener,noreferrer");
                                  toast.success("WhatsApp abierto");
                                }}
                                disabled={!platformTicketMessage.trim()}
                              >
                                💬
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Presiona "Enviar" para publicar en el sistema. 📧 y 💬 abren Gmail/WhatsApp Web con tu mensaje.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Notificaciones Adicionales (cuando no hay respuesta activa) */}
                      {selectedPlatformTicket.status !== 'closed' && (
                        <div className="space-y-2 pt-4 border-t">
                          <Label className="font-semibold text-sm">Contactar Directamente</Label>
                          <p className="text-xs text-muted-foreground">
                            Abre Gmail o WhatsApp Web para enviar un mensaje directo
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const email = selectedPlatformTicket.companies?.email;
                                if (!email) {
                                  toast.error("Esta empresa no tiene email registrado");
                                  return;
                                }
                                const subject = `Ticket ${selectedPlatformTicket.ticket_number} - ${selectedPlatformTicket.subject}`;
                                const body = `Hola,\n\nActualización sobre tu ticket ${selectedPlatformTicket.ticket_number}.\n\nSaludos,\nEquipo de Soporte`;
                                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                window.open(gmailUrl, '_blank');
                              }}
                            >
                              📧 Gmail
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const phone = selectedPlatformTicket.companies?.whatsapp_number || selectedPlatformTicket.companies?.phone;
                                if (!phone) {
                                  toast.error("Esta empresa no tiene número de teléfono registrado");
                                  return;
                                }
                                const cleanPhone = phone.replace(/\D/g, "");
                                const message = `Hola,\n\nActualización sobre tu ticket ${selectedPlatformTicket.ticket_number}.\n\nSaludos,\nEquipo de Soporte`;
                                const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                                window.open(waUrl, "_blank", "noopener,noreferrer");
                              }}
                            >
                              💬 WhatsApp
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="flex items-center justify-center h-[600px]">
                    <div className="text-center text-muted-foreground">
                      <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Selecciona un ticket para ver los detalles</p>
                      <p className="text-sm mt-2">Podrás ver info de la empresa y responder</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Empresas Registradas</CardTitle>
                    <CardDescription>
                      Gestiona todas las empresas del sistema
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar empresas..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={companyStatusFilter} onValueChange={setCompanyStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="active">Activas</SelectItem>
                      <SelectItem value="inactive">Inactivas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Suscripción</TableHead>
                      <TableHead>Próximo Pago</TableHead>
                      <TableHead>Deuda</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companiesPagination.paginatedData?.map((company) => {
                      const subscription = company.subscriptions?.[0];
                      return (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell>{company.email || "N/A"}</TableCell>
                          <TableCell>{company.phone || "N/A"}</TableCell>
                          <TableCell>
                            {getStatusBadge(company.active)}
                          </TableCell>
                          <TableCell>
                            {getSubscriptionStatus(company.subscriptions)}
                          </TableCell>
                          <TableCell>
                            {subscription?.next_payment_date
                              ? new Date(subscription.next_payment_date).toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {subscription?.amount_due ? (
                              <span className="font-medium text-destructive">
                                ${subscription.amount_due}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  window.open(`/app/guest/${company.id}`, '_blank');
                                }}
                              >
                                <Users className="h-4 w-4 mr-1" />
                                Ver como visitante
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedCompanyForModules(company);
                                  setModulesDialogOpen(true);
                                }}
                              >
                                <Package className="h-4 w-4 mr-1" />
                                Módulos
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedCompanyForPricing(company);
                                  setCustomPricingDialogOpen(true);
                                }}
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Precios
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => toggleCompanyMutation.mutate({ 
                                  companyId: company.id, 
                                  active: !company.active 
                                })}
                              >
                                {company.active ? "Desactivar" : "Activar"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={companiesPagination.currentPage}
                  totalPages={companiesPagination.totalPages}
                  totalItems={companiesPagination.totalItems}
                  startIndex={companiesPagination.startIndex}
                  endIndex={companiesPagination.endIndex}
                  pageSize={companiesPagination.pageSize}
                  canGoNext={companiesPagination.canGoNext}
                  canGoPrevious={companiesPagination.canGoPrevious}
                  onPageChange={companiesPagination.setCurrentPage}
                  onPageSizeChange={companiesPagination.setPageSize}
                  onNextPage={companiesPagination.goToNextPage}
                  onPreviousPage={companiesPagination.goToPreviousPage}
                  onFirstPage={companiesPagination.goToFirstPage}
                  onLastPage={companiesPagination.goToLastPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Notificaciones del Sistema</CardTitle>
                    <CardDescription>
                      Alertas y notificaciones importantes de todas las empresas
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <Select value={notificationFilter} onValueChange={setNotificationFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="unread">No leídas</SelectItem>
                      <SelectItem value="payment_overdue">Pagos vencidos</SelectItem>
                      <SelectItem value="system_error">Errores del sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Mensaje</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notificationsPagination.paginatedData?.map((notification) => (
                      <TableRow key={notification.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            )}
                            <Badge variant={notification.read ? "outline" : "default"}>
                              {notification.read ? "Leída" : "Nueva"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{notification.title}</TableCell>
                        <TableCell className="max-w-md">{notification.message}</TableCell>
                        <TableCell>
                          {getSeverityBadge(notification.severity)}
                        </TableCell>
                        <TableCell>
                          {new Date(notification.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {!notification.read && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                markNotificationReadMutation.mutate(notification.id)
                              }
                            >
                              Marcar como leída
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={notificationsPagination.currentPage}
                  totalPages={notificationsPagination.totalPages}
                  totalItems={notificationsPagination.totalItems}
                  startIndex={notificationsPagination.startIndex}
                  endIndex={notificationsPagination.endIndex}
                  pageSize={notificationsPagination.pageSize}
                  canGoNext={notificationsPagination.canGoNext}
                  canGoPrevious={notificationsPagination.canGoPrevious}
                  onPageChange={notificationsPagination.setCurrentPage}
                  onPageSizeChange={notificationsPagination.setPageSize}
                  onNextPage={notificationsPagination.goToNextPage}
                  onPreviousPage={notificationsPagination.goToPreviousPage}
                  onFirstPage={notificationsPagination.goToFirstPage}
                  onLastPage={notificationsPagination.goToLastPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Feedback de Usuarios</CardTitle>
                    <CardDescription>
                      Comentarios y sugerencias de las empresas
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <Select value={feedbackStatusFilter} onValueChange={setFeedbackStatusFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="in_progress">En progreso</SelectItem>
                      <SelectItem value="resolved">Resuelto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Mensaje</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbackPagination.paginatedData?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "pending"
                                ? "secondary"
                                : item.status === "resolved"
                                ? "default"
                                : "outline"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getFeedbackCategoryBadge(item.category)}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="space-y-1">
                            <p>{item.message}</p>
                            {item.admin_notes && (
                              <p className="text-xs text-muted-foreground">
                                Nota: {item.admin_notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.rating ? (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">{item.rating}</span>
                              <span className="text-muted-foreground">/5</span>
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(item.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Select
                            defaultValue={item.status}
                            onValueChange={(value) =>
                              updateFeedbackMutation.mutate({
                                feedbackId: item.id,
                                status: value,
                              })
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="in_progress">En progreso</SelectItem>
                              <SelectItem value="resolved">Resuelto</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={feedbackPagination.currentPage}
                  totalPages={feedbackPagination.totalPages}
                  totalItems={feedbackPagination.totalItems}
                  startIndex={feedbackPagination.startIndex}
                  endIndex={feedbackPagination.endIndex}
                  pageSize={feedbackPagination.pageSize}
                  canGoNext={feedbackPagination.canGoNext}
                  canGoPrevious={feedbackPagination.canGoPrevious}
                  onPageChange={feedbackPagination.setCurrentPage}
                  onPageSizeChange={feedbackPagination.setPageSize}
                  onNextPage={feedbackPagination.goToNextPage}
                  onPreviousPage={feedbackPagination.goToPreviousPage}
                  onFirstPage={feedbackPagination.goToFirstPage}
                  onLastPage={feedbackPagination.goToLastPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Pagos</CardTitle>
                    <CardDescription>
                      Administra los pagos y suscripciones de las empresas
                    </CardDescription>
                  </div>
                  <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Registrar Pago
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Registrar Nuevo Pago</DialogTitle>
                        <DialogDescription>
                          Ingresa los detalles del pago recibido
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="company">Empresa</Label>
                          <Select 
                            value={newPayment.company_id} 
                            onValueChange={(value) => setNewPayment({...newPayment, company_id: value})}
                          >
                            <SelectTrigger id="company">
                              <SelectValue placeholder="Seleccionar empresa" />
                            </SelectTrigger>
                            <SelectContent>
                              {companies?.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="amount">Monto</Label>
                          <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="method">Método de Pago</Label>
                          <Select 
                            value={newPayment.payment_method} 
                            onValueChange={(value) => setNewPayment({...newPayment, payment_method: value})}
                          >
                            <SelectTrigger id="method">
                              <SelectValue placeholder="Seleccionar método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="transfer">Transferencia</SelectItem>
                              <SelectItem value="cash">Efectivo</SelectItem>
                              <SelectItem value="card">Tarjeta</SelectItem>
                              <SelectItem value="check">Cheque</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="notes">Notas</Label>
                          <Textarea
                            id="notes"
                            placeholder="Detalles adicionales..."
                            value={newPayment.notes}
                            onChange={(e) => setNewPayment({...newPayment, notes: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="status">Estado</Label>
                          <Select 
                            value={newPayment.status} 
                            onValueChange={(value) => setNewPayment({...newPayment, status: value})}
                          >
                            <SelectTrigger id="status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="paid">Pagado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          onClick={() => createPaymentMutation.mutate(newPayment)}
                          disabled={!newPayment.company_id || !newPayment.amount}
                        >
                          Registrar Pago
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex gap-4 mt-4">
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="paid">Pagado</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentsPagination.paginatedData?.map((payment) => {
                      const company = companies?.find(c => c.id === payment.company_id);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {company?.name || "N/A"}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">${Number(payment.amount).toLocaleString()}</span>
                          </TableCell>
                          <TableCell>
                            {payment.payment_method ? (
                              <Badge variant="outline">{payment.payment_method}</Badge>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {getPaymentStatusBadge(payment.status)}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {payment.notes && (
                              <p className="text-sm text-muted-foreground truncate">
                                {payment.notes}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              defaultValue={payment.status}
                              onValueChange={(value) =>
                                updatePaymentMutation.mutate({
                                  paymentId: payment.id,
                                  status: value,
                                })
                              }
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendiente</SelectItem>
                                <SelectItem value="paid">Pagado</SelectItem>
                                <SelectItem value="overdue">Vencido</SelectItem>
                                <SelectItem value="cancelled">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={paymentsPagination.currentPage}
                  totalPages={paymentsPagination.totalPages}
                  totalItems={paymentsPagination.totalItems}
                  startIndex={paymentsPagination.startIndex}
                  endIndex={paymentsPagination.endIndex}
                  pageSize={paymentsPagination.pageSize}
                  canGoNext={paymentsPagination.canGoNext}
                  canGoPrevious={paymentsPagination.canGoPrevious}
                  onPageChange={paymentsPagination.setCurrentPage}
                  onPageSizeChange={paymentsPagination.setPageSize}
                  onNextPage={paymentsPagination.goToNextPage}
                  onPreviousPage={paymentsPagination.goToPreviousPage}
                  onFirstPage={paymentsPagination.goToFirstPage}
                  onLastPage={paymentsPagination.goToLastPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="flex justify-end gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const data = revenueAnalytics?.map(item => ({
                    Mes: item.month,
                    Ingresos: item.revenue
                  })) || [];
                  exportToExcel(data, 'analytics-ingresos', 'Ingresos');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const headers = ['Mes', 'Ingresos'];
                  const data = revenueAnalytics?.map(item => [
                    item.month,
                    formatCurrency(item.revenue)
                  ]) || [];
                  exportToPDF('Analytics de Ingresos', headers, data, 'analytics-ingresos');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Ingresos Mensuales</CardTitle>
                <CardDescription>Evolución de ingresos por mes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={revenueAnalytics || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>MRR (Monthly Recurring Revenue)</CardTitle>
                  <CardDescription>Ingresos recurrentes mensuales</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatCurrency(
                      stats?.totalRevenue ? Math.round(stats.totalRevenue / 12) : 0
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Promedio mensual basado en ingresos totales
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tasa de Crecimiento</CardTitle>
                  <CardDescription>Comparación mes actual vs anterior</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-green-500" />
                    <span className="text-3xl font-bold text-green-500">
                      {revenueAnalytics && revenueAnalytics.length >= 2
                        ? `${Math.round(
                            ((revenueAnalytics[revenueAnalytics.length - 1].revenue -
                              revenueAnalytics[revenueAnalytics.length - 2].revenue) /
                              revenueAnalytics[revenueAnalytics.length - 2].revenue) *
                              100
                          )}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Crecimiento respecto al mes anterior
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Gestión de Usuarios Globales</CardTitle>
                    <CardDescription>
                      Todos los usuarios registrados en todas las empresas
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const data = allUsers?.map(user => ({
                        ID: user.id,
                        'Empresa': (user.companies as any)?.name || 'N/A',
                        'Rol': user.role,
                        'Estado': user.active ? 'Activo' : 'Inactivo',
                        'Fecha Creación': formatDate(user.created_at || '')
                      })) || [];
                      exportToExcel(data, 'usuarios-plataforma', 'Usuarios');
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuarios..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Usuario</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha Creación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersPagination.paginatedData?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-xs">
                          {user.user_id?.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          {(user.companies as any)?.name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.active ? (
                            <Badge variant="default">Activo</Badge>
                          ) : (
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(user.created_at || '')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={usersPagination.currentPage}
                  totalPages={usersPagination.totalPages}
                  totalItems={usersPagination.totalItems}
                  startIndex={usersPagination.startIndex}
                  endIndex={usersPagination.endIndex}
                  pageSize={usersPagination.pageSize}
                  canGoNext={usersPagination.canGoNext}
                  canGoPrevious={usersPagination.canGoPrevious}
                  onPageChange={usersPagination.setCurrentPage}
                  onPageSizeChange={usersPagination.setPageSize}
                  onNextPage={usersPagination.goToNextPage}
                  onPreviousPage={usersPagination.goToPreviousPage}
                  onFirstPage={usersPagination.goToFirstPage}
                  onLastPage={usersPagination.goToLastPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Plans Tab */}
          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Planes de Suscripción</CardTitle>
                    <CardDescription>
                      Gestionar planes disponibles para las empresas
                    </CardDescription>
                  </div>
                  <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingPlan ? 'Editar Plan' : 'Crear Nuevo Plan'}
                        </DialogTitle>
                        <DialogDescription>
                          Complete los detalles del plan de suscripción
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nombre del Plan</Label>
                          <Input
                            value={newPlan.name}
                            onChange={(e) =>
                              setNewPlan({ ...newPlan, name: e.target.value })
                            }
                            placeholder="Ej: Plan Pro"
                          />
                        </div>
                        <div>
                          <Label>Descripción</Label>
                          <Textarea
                            value={newPlan.description}
                            onChange={(e) =>
                              setNewPlan({ ...newPlan, description: e.target.value })
                            }
                            placeholder="Descripción del plan"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Precio</Label>
                            <Input
                              type="number"
                              value={newPlan.price}
                              onChange={(e) =>
                                setNewPlan({ ...newPlan, price: e.target.value })
                              }
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label>Ciclo de Facturación</Label>
                            <Select
                              value={newPlan.billing_period}
                              onValueChange={(value) =>
                                setNewPlan({ ...newPlan, billing_period: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monthly">Mensual</SelectItem>
                                <SelectItem value="yearly">Anual</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Máximo de Usuarios</Label>
                          <Input
                            type="number"
                            value={newPlan.max_users}
                            onChange={(e) =>
                              setNewPlan({ ...newPlan, max_users: e.target.value })
                            }
                            placeholder="Ej: 5"
                          />
                        </div>
                        <div>
                          <Label>Características (una por línea)</Label>
                          <Textarea
                            value={newPlan.features}
                            onChange={(e) =>
                              setNewPlan({ ...newPlan, features: e.target.value })
                            }
                            placeholder="Característica 1&#10;Característica 2&#10;Característica 3"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPlanDialogOpen(false);
                            setEditingPlan(null);
                            setNewPlan({
                              name: '',
                              description: '',
                              price: '',
                              billing_period: 'monthly',
                              max_users: '',
                              features: ''
                            });
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={async () => {
                            try {
                              const planData = {
                                name: newPlan.name,
                                description: newPlan.description,
                                price: Number(newPlan.price),
                                billing_period: newPlan.billing_period,
                                max_users: Number(newPlan.max_users),
                                features: newPlan.features.split('\n').filter(f => f.trim())
                              };

                              if (editingPlan) {
                                const { error } = await supabase
                                  .from('subscription_plans')
                                  .update(planData)
                                  .eq('id', editingPlan.id);
                                if (error) throw error;
                                toast.success('Plan actualizado exitosamente');
                              } else {
                                const { error } = await supabase
                                  .from('subscription_plans')
                                  .insert(planData);
                                if (error) throw error;
                                toast.success('Plan creado exitosamente');
                              }

                              queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
                              setPlanDialogOpen(false);
                              setEditingPlan(null);
                              setNewPlan({
                                name: '',
                                description: '',
                                price: '',
                                billing_period: 'monthly',
                                max_users: '',
                                features: ''
                              });
                            } catch (error: any) {
                              toast.error('Error: ' + error.message);
                            }
                          }}
                        >
                          {editingPlan ? 'Actualizar' : 'Crear'} Plan
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {subscriptionPlans?.map((plan) => (
                    <Card key={plan.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>{plan.name}</CardTitle>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingPlan(plan);
                                setNewPlan({
                                  name: plan.name,
                                  description: plan.description || '',
                                  price: plan.price.toString(),
                                  billing_period: plan.billing_period,
                                  max_users: plan.max_users?.toString() || '',
                                  features: Array.isArray(plan.features) 
                                    ? plan.features.join('\n') 
                                    : ''
                                });
                                setPlanDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (confirm('¿Está seguro de eliminar este plan?')) {
                                  const { error } = await supabase
                                    .from('subscription_plans')
                                    .delete()
                                    .eq('id', plan.id);
                                  if (error) {
                                    toast.error('Error al eliminar');
                                  } else {
                                    toast.success('Plan eliminado');
                                    queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
                                  }
                                }
                              }}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="text-3xl font-bold">
                              {formatCurrency(plan.price)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {plan.billing_period === 'monthly' ? 'por mes' : 'por año'}
                            </p>
                          </div>
                          {plan.max_users && (
                            <div className="text-sm">
                              <Badge variant="secondary">
                                Hasta {plan.max_users} usuarios
                              </Badge>
                            </div>
                          )}
                          {plan.features && Array.isArray(plan.features) && (
                            <ul className="space-y-2 text-sm">
                              {plan.features.map((feature: string, idx: number) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  {feature}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Registro de Auditoría</CardTitle>
                    <CardDescription>
                      Historial de acciones administrativas en la plataforma
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por usuario, entidad o descripción..."
                      value={auditLogSearch}
                      onChange={(e) => setAuditLogSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={auditLogActionFilter} onValueChange={setAuditLogActionFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las acciones</SelectItem>
                      <SelectItem value="create">Crear</SelectItem>
                      <SelectItem value="update">Actualizar</SelectItem>
                      <SelectItem value="delete">Eliminar</SelectItem>
                      <SelectItem value="login">Inicio de sesión</SelectItem>
                      <SelectItem value="logout">Cierre de sesión</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>Entidad</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogsPagination.paginatedData && auditLogsPagination.paginatedData.length > 0 ? (
                      auditLogsPagination.paginatedData.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">
                            {new Date(log.created_at).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{log.user_email || "Sistema"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                log.action === 'create' ? 'default' :
                                log.action === 'update' ? 'secondary' :
                                log.action === 'delete' ? 'destructive' :
                                'outline'
                              }
                            >
                              {log.action === 'create' ? 'Crear' :
                               log.action === 'update' ? 'Actualizar' :
                               log.action === 'delete' ? 'Eliminar' :
                               log.action === 'login' ? 'Login' :
                               log.action === 'logout' ? 'Logout' :
                               log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {log.table_name || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {log.changed_fields?.join(", ") || "Sin cambios registrados"}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.ip_address || "N/A"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No se encontraron registros de auditoría
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={auditLogsPagination.currentPage}
                  totalPages={auditLogsPagination.totalPages}
                  totalItems={auditLogsPagination.totalItems}
                  startIndex={auditLogsPagination.startIndex}
                  endIndex={auditLogsPagination.endIndex}
                  pageSize={auditLogsPagination.pageSize}
                  canGoNext={auditLogsPagination.canGoNext}
                  canGoPrevious={auditLogsPagination.canGoPrevious}
                  onPageChange={auditLogsPagination.setCurrentPage}
                  onPageSizeChange={auditLogsPagination.setPageSize}
                  onNextPage={auditLogsPagination.goToNextPage}
                  onPreviousPage={auditLogsPagination.goToPreviousPage}
                  onFirstPage={auditLogsPagination.goToFirstPage}
                  onLastPage={auditLogsPagination.goToLastPage}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations Monitor Tab */}
          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5" />
                  Monitor de Integraciones
                </CardTitle>
                <CardDescription>
                  Estado de integraciones AFIP, logs de sincronización y errores
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AFIP Status Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Estado AFIP por Empresa
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Punto de Venta</TableHead>
                        <TableHead>Tipo Comprobante</TableHead>
                        <TableHead>Último Número</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Última Actualización</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {afipData?.map((afip: any) => (
                        <TableRow key={afip.id}>
                          <TableCell className="font-medium">
                            {afip.companies?.name || "N/A"}
                          </TableCell>
                          <TableCell>{afip.punto_venta}</TableCell>
                          <TableCell>{afip.tipo_comprobante}</TableCell>
                          <TableCell>{afip.ultimo_numero}</TableCell>
                          <TableCell>
                            {afip.activo ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Activo
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" />
                                Inactivo
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(afip.updated_at || afip.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Other Integrations Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Otras Integraciones</h3>
                    <Select value={integrationStatusFilter} onValueChange={setIntegrationStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filtrar por estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="active">Activas</SelectItem>
                        <SelectItem value="inactive">Inactivas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Última Sincronización</TableHead>
                        <TableHead>Auto Email</TableHead>
                        <TableHead>Auto Factura</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {integrationsData
                        ?.filter((int: any) => {
                          if (integrationStatusFilter === "all") return true;
                          if (integrationStatusFilter === "active") return int.active;
                          if (integrationStatusFilter === "inactive") return !int.active;
                          return true;
                        })
                        .map((integration: any) => (
                          <TableRow key={integration.id}>
                            <TableCell className="font-medium">
                              {integration.companies?.name || "N/A"}
                            </TableCell>
                            <TableCell>{integration.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {integration.integration_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {integration.active ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Activa
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-gray-600">
                                  <XCircle className="h-4 w-4" />
                                  Inactiva
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {integration.last_sync_at
                                ? new Date(integration.last_sync_at).toLocaleString()
                                : "Nunca"}
                            </TableCell>
                            <TableCell>
                              {integration.auto_email ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-gray-400" />
                              )}
                            </TableCell>
                            <TableCell>
                              {integration.auto_invoice ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-gray-400" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Integration Logs Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Logs de Sincronización (últimos 100)</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Integración</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Mensaje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {integrationLogs?.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {new Date(log.created_at || "").toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.companies?.name || "N/A"}
                          </TableCell>
                          <TableCell>
                            {log.integrations?.name || "N/A"}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({log.integrations?.integration_type})
                            </span>
                          </TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>
                            {log.status === "success" ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Éxito
                              </span>
                            ) : log.status === "error" ? (
                              <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-4 w-4" />
                                Error
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-yellow-600">
                                <AlertCircle className="h-4 w-4" />
                                {log.status}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            {log.message || "Sin mensaje"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onboarding Tab */}
          <TabsContent value="onboarding" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Panel de Onboarding</CardTitle>
                    <CardDescription>
                      Progreso de configuración inicial de cada empresa
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      if (!onboardingData) return;
                      exportToExcel(
                        onboardingData.map((o: any) => ({
                          'Empresa': o.companies?.name || 'N/A',
                          'Progreso (%)': o.completion_percentage || 0,
                          'Info Empresa': o.company_info_completed ? 'Sí' : 'No',
                          'Primer Producto': o.first_product_added ? 'Sí' : 'No',
                          'Primer Cliente': o.first_customer_added ? 'Sí' : 'No',
                          'Primera Venta': o.first_sale_completed ? 'Sí' : 'No',
                          'Método Pago': o.payment_method_configured ? 'Sí' : 'No',
                          'Equipo Invitado': o.team_members_invited ? 'Sí' : 'No',
                          'AFIP Config.': o.afip_configured ? 'Sí' : 'No',
                          'Iniciado': o.started_at ? new Date(o.started_at).toLocaleDateString() : 'N/A',
                          'Completado': o.completed_at ? new Date(o.completed_at).toLocaleDateString() : 'En progreso'
                        })),
                        'onboarding-empresas'
                      );
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Completados</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {onboardingData?.filter((o: any) => o.completion_percentage === 100).length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">100% configurado</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-yellow-600">
                        {onboardingData?.filter((o: any) => o.completion_percentage > 0 && o.completion_percentage < 100).length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Configurando</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Sin Iniciar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {onboardingData?.filter((o: any) => o.completion_percentage === 0).length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">0% progreso</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Promedio General</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {onboardingData && onboardingData.length > 0
                          ? Math.round(onboardingData.reduce((sum: number, o: any) => sum + (o.completion_percentage || 0), 0) / onboardingData.length)
                          : 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">Todas las empresas</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Onboarding Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Progreso</TableHead>
                      <TableHead className="text-center">Info</TableHead>
                      <TableHead className="text-center">Producto</TableHead>
                      <TableHead className="text-center">Cliente</TableHead>
                      <TableHead className="text-center">Venta</TableHead>
                      <TableHead className="text-center">Pago</TableHead>
                      <TableHead className="text-center">Equipo</TableHead>
                      <TableHead className="text-center">AFIP</TableHead>
                      <TableHead>Última Actividad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {onboardingData && onboardingData.length > 0 ? (
                      onboardingData.map((onb: any) => (
                        <TableRow key={onb.id}>
                          <TableCell className="font-medium">
                            {onb.companies?.name || "N/A"}
                            {!onb.companies?.active && (
                              <Badge variant="secondary" className="ml-2">Inactiva</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all ${
                                    onb.completion_percentage === 100 
                                      ? 'bg-green-500' 
                                      : onb.completion_percentage >= 50 
                                        ? 'bg-yellow-500' 
                                        : 'bg-red-500'
                                  }`}
                                  style={{ width: `${onb.completion_percentage || 0}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{onb.completion_percentage || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {onb.company_info_completed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {onb.first_product_added ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {onb.first_customer_added ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {onb.first_sale_completed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {onb.payment_method_configured ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {onb.team_members_invited ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {onb.afip_configured ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {onb.last_activity_at 
                              ? new Date(onb.last_activity_at).toLocaleDateString()
                              : 'Sin actividad'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          No hay datos de onboarding disponibles
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Dialog para gestionar módulos de empresa */}
      <Dialog open={modulesDialogOpen} onOpenChange={setModulesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Gestionar Módulos - {selectedCompanyForModules?.name}
            </DialogTitle>
            <DialogDescription>
              Activa o desactiva los módulos disponibles para esta empresa
            </DialogDescription>
          </DialogHeader>
          
          {selectedCompanyForModules && (
            <CompanyModuleSelector 
              companyId={selectedCompanyForModules.id} 
              onModulesChange={() => {
                // Refrescar datos de empresas si es necesario
                queryClient.invalidateQueries({ queryKey: ['platform-companies'] });
              }}
            />
          )}
          
          <DialogFooter>
            <Button onClick={() => setModulesDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestionar precios personalizados */}
      <Dialog open={customPricingDialogOpen} onOpenChange={setCustomPricingDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Precios Personalizados - {selectedCompanyForPricing?.name}
            </DialogTitle>
            <DialogDescription>
              Configura precios especiales para módulos específicos de esta empresa
            </DialogDescription>
          </DialogHeader>
          
          {selectedCompanyForPricing && (
            <CustomPricingManager 
              companyId={selectedCompanyForPricing.id}
              companyName={selectedCompanyForPricing.name}
            />
          )}
          
          <DialogFooter>
            <Button onClick={() => setCustomPricingDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
