import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, Users, DollarSign, TrendingUp, LogOut, ShoppingCart, AlertTriangle, MessageSquare, Bell, CheckCircle, XCircle } from "lucide-react";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useNavigate, Navigate } from "react-router-dom";

export default function PlatformAdmin() {
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  console.log("PlatformAdmin render - adminLoading:", adminLoading, "isPlatformAdmin:", isPlatformAdmin);

  // Show loading while checking admin status
  if (adminLoading) {
    console.log("Showing admin loading screen");
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
    console.log("Not platform admin, redirecting to /");
    return <Navigate to="/" replace />;
  }

  console.log("Platform admin confirmed, loading companies...");

  // Fetch all companies with their subscriptions
  const { data: companies, isLoading, error: companiesError } = useQuery({
    queryKey: ["platform-companies"],
    queryFn: async () => {
      console.log("Fetching companies...");
      const { data, error } = await supabase
        .from("companies")
        .select(`
          *,
          company_subscriptions (
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

      if (error) {
        console.error("Error fetching companies:", error);
        throw error;
      }
      console.log("Companies fetched:", data);
      return data;
    },
  });

  console.log("Companies query state - isLoading:", isLoading, "companiesError:", companiesError, "companies:", companies);

  // Fetch feedback
  // TODO: Uncomment when platform_feedback table is created
  // const { data: feedbacks } = useQuery({
  //   queryKey: ["platform-feedback"],
  //   queryFn: async () => {
  //     const { data, error } = await supabase
  //       .from("platform_feedback")
  //       .select(`
  //         *,
  //         companies (name)
  //       `)
  //       .order("created_at", { ascending: false })
  //       .limit(10);

  //     if (error) throw error;
  //     return data;
  //   },
  // });
  const feedbacks = [];

  // Fetch notifications
  // TODO: Uncomment when platform_notifications table is created
  // const { data: notifications } = useQuery({
  //   queryKey: ["platform-notifications"],
  //   queryFn: async () => {
  //     const { data, error } = await supabase
  //       .from("platform_notifications")
  //       .select(`
  //         *,
  //         companies (name)
  //       `)
  //       .eq("read", false)
  //       .order("created_at", { ascending: false });

  //     if (error) throw error;
  //     return data;
  //   },
  // });
  const notifications = [];

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
      toast.success("Estado de la empresa actualizado");
    },
    onError: () => {
      toast.error("Error al actualizar el estado");
    },
  });

  // Mark notification as read
  // TODO: Uncomment when platform_notifications table is created
  // const markNotificationReadMutation = useMutation({
  //   mutationFn: async (notificationId: string) => {
  //     const { error } = await supabase
  //       .from("platform_notifications")
  //       .update({ read: true })
  //       .eq("id", notificationId);

  //     if (error) throw error;
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["platform-notifications"] });
  //     toast.success("Notificación marcada como leída");
  //   },
  // });

  // Update feedback status
  // TODO: Uncomment when platform_feedback table is created
  // const updateFeedbackMutation = useMutation({
  //   mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) => {
  //     const { error } = await supabase
  //       .from("platform_feedback")
  //       .update({ status, admin_notes })
  //       .eq("id", id);

  //     if (error) throw error;
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["platform-feedback"] });
  //     toast.success("Feedback actualizado");
  //   },
  // });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    } else {
      navigate("/auth");
      toast.success("Sesión cerrada exitosamente");
    }
  };

  if (isLoading) {
    console.log("Companies still loading...");
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
    console.error("Companies error detected:", companiesError);
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center text-destructive">
          <p className="text-xl font-bold mb-2">Error al cargar empresas</p>
          <p>{companiesError.message}</p>
        </div>
      </div>
    );
  }

  console.log("Rendering platform admin dashboard");

  const getStatusBadge = (active: boolean) => {
    return active ? (
      <Badge variant="default" className="bg-green-500">Activa</Badge>
    ) : (
      <Badge variant="destructive">Inactiva</Badge>
    );
  };

  const getSubscriptionStatus = (subscription: any) => {
    if (!subscription || subscription.length === 0) {
      return <Badge variant="secondary">Sin suscripción</Badge>;
    }

    const status = subscription[0].status;
    const colors: Record<string, string> = {
      active: "bg-green-500",
      trial: "bg-blue-500",
      suspended: "bg-yellow-500",
      cancelled: "bg-red-500",
    };

    return (
      <Badge className={colors[status] || "bg-gray-500"}>
        {status === "active" ? "Activa" : 
         status === "trial" ? "Prueba" :
         status === "suspended" ? "Suspendida" : "Cancelada"}
      </Badge>
    );
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  // Calculate stats
  const totalCompanies = companies?.length || 0;
  const activeCompanies = companies?.filter(c => c.active)?.length || 0;
  const totalUsers = companies?.reduce((acc, c) => acc + (c.company_users?.filter((u: any) => u.active).length || 0), 0) || 0;
  const totalRevenue = companies?.reduce((acc, c) => {
    const sub = c.company_subscriptions?.[0];
    return acc + (sub?.amount_due || 0);
  }, 0) || 0;

  const overduePayments = companies?.filter(c => {
    const sub = c.company_subscriptions?.[0];
    return sub && sub.next_payment_date && new Date(sub.next_payment_date) < new Date();
  }).length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header with logout */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">RetailSnap</h1>
              <p className="text-xs text-muted-foreground">Panel de Administración</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Panel de Administración de Plataforma</h1>
          <p className="text-muted-foreground">Gestión completa de empresas y suscripciones</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Empresas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCompanies}</div>
              <p className="text-xs text-muted-foreground">
                {activeCompanies} activas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Usuarios activos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Facturación estimada
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagos Vencidos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{overduePayments}</div>
              <p className="text-xs text-muted-foreground">
                Requieren atención
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalCompanies > 0 ? ((activeCompanies / totalCompanies) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Empresas activas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="companies" className="space-y-4">
          <TabsList>
            <TabsTrigger value="companies">Empresas</TabsTrigger>
            {/* TODO: Uncomment when platform_notifications and platform_feedback tables are created
            <TabsTrigger value="notifications">
              Notificaciones {notifications && notifications.length > 0 && (
                <Badge variant="destructive" className="ml-2">{notifications.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            */}
          </TabsList>

          <TabsContent value="companies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Empresas Registradas</CardTitle>
                <CardDescription>
                  Lista completa de empresas en la plataforma con detalles de suscripción
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Empresa</th>
                        <th className="p-3 text-left font-medium">Email</th>
                        <th className="p-3 text-left font-medium">Usuarios</th>
                        <th className="p-3 text-left font-medium">Plan</th>
                        <th className="p-3 text-left font-medium">Próximo Pago</th>
                        <th className="p-3 text-left font-medium">Monto</th>
                        <th className="p-3 text-left font-medium">Suscripción</th>
                        <th className="p-3 text-left font-medium">Estado</th>
                        <th className="p-3 text-left font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies?.map((company) => {
                        const subscription = company.company_subscriptions?.[0];
                        const plan = subscription?.subscription_plans;
                        const activeUsers = company.company_users?.filter((u: any) => u.active).length || 0;
                        const isOverdue = subscription?.next_payment_date && new Date(subscription.next_payment_date) < new Date();

                        return (
                          <tr key={company.id} className="border-b">
                            <td className="p-3">
                              <div>
                                <div className="font-medium">{company.name}</div>
                                {company.tax_id && (
                                  <div className="text-sm text-muted-foreground">
                                    CUIT: {company.tax_id}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-sm">{company.email || "-"}</td>
                            <td className="p-3 text-sm">{activeUsers}</td>
                            <td className="p-3">
                              {plan ? (
                                <div>
                                  <div className="font-medium">{plan.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    ${plan.price}/{plan.billing_period}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              {subscription?.next_payment_date ? (
                                <div className={isOverdue ? "text-destructive font-medium" : ""}>
                                  {new Date(subscription.next_payment_date).toLocaleDateString()}
                                  {isOverdue && (
                                    <div className="text-xs">¡Vencido!</div>
                                  )}
                                </div>
                              ) : "-"}
                            </td>
                            <td className="p-3">
                              {subscription?.amount_due ? (
                                <span className={isOverdue ? "text-destructive font-medium" : ""}>
                                  ${subscription.amount_due.toFixed(2)}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="p-3">
                              {getSubscriptionStatus(company.company_subscriptions)}
                            </td>
                            <td className="p-3">
                              {getStatusBadge(company.active)}
                            </td>
                            <td className="p-3">
                              <Switch
                                checked={company.active}
                                onCheckedChange={(checked) =>
                                  toggleCompanyMutation.mutate({
                                    companyId: company.id,
                                    active: checked,
                                  })
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TODO: Uncomment when platform_notifications and platform_feedback tables are created
          <TabsContent value="notifications" className="space-y-4">
            ...
          </TabsContent>

          <TabsContent value="feedback" className="space-y-4">
            ...
          </TabsContent>
          */}
        </Tabs>
      </div>
    </div>
  );
}
