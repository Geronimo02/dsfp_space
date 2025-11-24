import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, Users, DollarSign, TrendingUp, LogOut, ShoppingCart, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useNavigate, Navigate } from "react-router-dom";

export default function PlatformAdmin() {
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    return <Navigate to="/" replace />;
  }

  // Fetch all companies with their subscriptions
  const { data: companies, isLoading, error: companiesError } = useQuery({
    queryKey: ["platform-companies"],
    queryFn: async () => {
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
          companies (name),
          company_subscriptions (status)
        `)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
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
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-notifications"] });
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
      
      if (status === "resolved") {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("platform_feedback")
        .update(updates)
        .eq("id", feedbackId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-feedback"] });
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
      toast.success("Pago actualizado");
    },
    onError: (error) => {
      toast.error("Error al actualizar pago");
      console.error("Error:", error);
    },
  });

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
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'info':
      default:
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-green-500/10 text-green-500",
      pending: "bg-yellow-500/10 text-yellow-500",
      failed: "bg-red-500/10 text-red-500",
      refunded: "bg-blue-500/10 text-blue-500"
    };
    return (
      <Badge className={variants[status] || variants.pending}>
        {status === 'completed' && 'Completado'}
        {status === 'pending' && 'Pendiente'}
        {status === 'failed' && 'Fallido'}
        {status === 'refunded' && 'Reembolsado'}
      </Badge>
    );
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

        <div className="space-y-4">
          <Tabs defaultValue="companies" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="companies">Empresas</TabsTrigger>
              <TabsTrigger value="notifications">
                Notificaciones
                {notifications?.filter((n: any) => !n.read).length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {notifications?.filter((n: any) => !n.read).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
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

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notificaciones del Sistema</CardTitle>
                  <CardDescription>
                    Alertas y notificaciones importantes de las empresas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {notifications && notifications.length > 0 ? (
                      notifications.map((notification: any) => (
                        <div
                          key={notification.id}
                          className={`flex items-start gap-4 p-4 border rounded-lg ${
                            !notification.read ? 'bg-muted/50' : ''
                          }`}
                        >
                          {getSeverityIcon(notification.severity)}
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-sm text-muted-foreground">{notification.message}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {notification.companies?.name}
                              <span>•</span>
                              {new Date(notification.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          {!notification.read && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markNotificationReadMutation.mutate(notification.id)}
                            >
                              Marcar leída
                            </Button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No hay notificaciones
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Feedback de Usuarios</CardTitle>
                  <CardDescription>
                    Sugerencias, reportes y comentarios de los usuarios
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Asunto</TableHead>
                        <TableHead>Prioridad</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feedbacks && feedbacks.length > 0 ? (
                        feedbacks.map((feedback: any) => (
                          <TableRow key={feedback.id}>
                            <TableCell>{feedback.companies?.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{feedback.type}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{feedback.subject}</TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  feedback.priority === 'critical' ? 'destructive' :
                                  feedback.priority === 'high' ? 'default' : 'secondary'
                                }
                              >
                                {feedback.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={feedback.status === 'resolved' ? 'default' : 'secondary'}>
                                {feedback.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(feedback.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const newStatus = feedback.status === 'resolved' ? 'pending' : 'resolved';
                                  updateFeedbackMutation.mutate({
                                    feedbackId: feedback.id,
                                    status: newStatus
                                  });
                                }}
                              >
                                {feedback.status === 'resolved' ? 'Reabrir' : 'Resolver'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No hay feedback registrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Administración de Pagos</CardTitle>
                  <CardDescription>
                    Gestión de pagos y facturación de suscripciones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha Pago</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments && payments.length > 0 ? (
                        payments.map((payment: any) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.companies?.name}</TableCell>
                            <TableCell>
                              ${payment.amount.toLocaleString()} {payment.currency}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{payment.payment_method || 'N/A'}</Badge>
                            </TableCell>
                            <TableCell>{getPaymentStatusBadge(payment.status)}</TableCell>
                            <TableCell>
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {payment.due_date ? new Date(payment.due_date).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const newStatus = payment.status === 'completed' ? 'pending' : 'completed';
                                  updatePaymentMutation.mutate({
                                    paymentId: payment.id,
                                    status: newStatus
                                  });
                                }}
                              >
                                {payment.status === 'completed' ? 'Revertir' : 'Confirmar'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No hay pagos registrados
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
