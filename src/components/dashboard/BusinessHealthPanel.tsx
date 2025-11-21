import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HealthIndicator } from "./HealthIndicator";
import { Package, TrendingUp, Users, AlertTriangle, DollarSign, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface BusinessHealthPanelProps {
  companyId: string;
}

export function BusinessHealthPanel({ companyId }: BusinessHealthPanelProps) {
  const navigate = useNavigate();

  // Stock crítico
  const { data: stockHealth } = useQuery({
    queryKey: ["stock-health", companyId],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from("products")
        .select("stock, min_stock")
        .eq("company_id", companyId)
        .eq("active", true);

      if (error) throw error;

      const critical = products?.filter(p => p.stock <= p.min_stock).length || 0;
      const warning = products?.filter(p => p.stock > p.min_stock && p.stock <= p.min_stock * 1.5).length || 0;
      const total = products?.length || 0;

      let status: "healthy" | "warning" | "critical" = "healthy";
      if (critical > 0) status = "critical";
      else if (warning > 0) status = "warning";

      return {
        status,
        critical,
        warning,
        total,
        value: critical > 0 ? `${critical} críticos` : warning > 0 ? `${warning} bajos` : "OK",
      };
    },
    enabled: !!companyId,
  });

  // Salud financiera (cobranzas)
  const { data: financialHealth } = useQuery({
    queryKey: ["financial-health", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_account_movements")
        .select("debit_amount, due_date, status")
        .eq("company_id", companyId)
        .eq("movement_type", "sale")
        .in("status", ["pending", "partial"]);

      if (error) throw error;

      const today = new Date();
      const overdue = data?.filter(m => m.due_date && new Date(m.due_date) < today) || [];
      const overdueAmount = overdue.reduce((sum, m) => sum + Number(m.debit_amount), 0);
      const totalPending = data?.reduce((sum, m) => sum + Number(m.debit_amount), 0) || 0;

      const overduePercentage = totalPending > 0 ? (overdueAmount / totalPending) * 100 : 0;

      let status: "healthy" | "warning" | "critical" = "healthy";
      if (overduePercentage > 30) status = "critical";
      else if (overduePercentage > 10) status = "warning";

      return {
        status,
        overdueCount: overdue.length,
        overdueAmount,
        totalPending,
        value: overdue.length > 0 ? `${overdue.length} vencidas` : "Al día",
      };
    },
    enabled: !!companyId,
  });

  // Salud de clientes
  const { data: customerHealth } = useQuery({
    queryKey: ["customer-health", companyId],
    queryFn: async () => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data: customers, error: custError } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", companyId);

      if (custError) throw custError;

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("customer_id, created_at")
        .eq("company_id", companyId)
        .gte("created_at", threeMonthsAgo.toISOString())
        .not("customer_id", "is", null);

      if (salesError) throw salesError;

      const activeCustomers = new Set(sales?.map(s => s.customer_id));
      const totalCustomers = customers?.length || 0;
      const inactiveCount = totalCustomers - activeCustomers.size;
      const inactivePercentage = totalCustomers > 0 ? (inactiveCount / totalCustomers) * 100 : 0;

      let status: "healthy" | "warning" | "critical" = "healthy";
      if (inactivePercentage > 40) status = "critical";
      else if (inactivePercentage > 20) status = "warning";

      return {
        status,
        inactiveCount,
        totalCustomers,
        activeCount: activeCustomers.size,
        value: inactiveCount > 0 ? `${inactiveCount} inactivos` : "Activos",
      };
    },
    enabled: !!companyId,
  });

  // Alertas recientes (últimas 10 no leídas)
  const { data: recentAlerts } = useQuery({
    queryKey: ["recent-alerts", companyId],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const alertPriority = (type: string) => {
    if (type === "low_stock" || type === "overdue_invoice") return "critical";
    if (type === "expiring_product" || type === "expiring_check") return "warning";
    return "info";
  };

  return (
    <div className="space-y-6">
      {/* Health Indicators */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">Indicadores de Salud</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <HealthIndicator
            title="Inventario"
            status={stockHealth?.status || "healthy"}
            value={stockHealth?.value || "Cargando..."}
            description={`${stockHealth?.total || 0} productos activos`}
            icon={Package}
            onClick={() => navigate("/inventory-alerts")}
          />

          <HealthIndicator
            title="Finanzas"
            status={financialHealth?.status || "healthy"}
            value={financialHealth?.value || "Cargando..."}
            description={`Total pendiente: $${financialHealth?.totalPending.toFixed(0) || 0}`}
            icon={DollarSign}
            onClick={() => navigate("/accounts-receivable")}
          />

          <HealthIndicator
            title="Clientes"
            status={customerHealth?.status || "healthy"}
            value={customerHealth?.value || "Cargando..."}
            description={`${customerHealth?.activeCount || 0} de ${customerHealth?.totalCustomers || 0} activos últimos 3 meses`}
            icon={Users}
            onClick={() => navigate("/customers")}
          />
        </div>
      </div>

      {/* Priority Alerts */}
      {recentAlerts && recentAlerts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <CardTitle>Alertas Prioritarias</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/inventory-alerts")}
            >
              Ver todas
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => navigate("/inventory-alerts")}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          alertPriority(alert.type) === "critical"
                            ? "destructive"
                            : alertPriority(alert.type) === "warning"
                            ? "default"
                            : "outline"
                        }
                      >
                        {alert.type === "low_stock"
                          ? "Stock Bajo"
                          : alert.type === "overdue_invoice"
                          ? "Vencida"
                          : alert.type === "expiring_product"
                          ? "Por Vencer"
                          : alert.type === "expiring_check"
                          ? "Cheque"
                          : "Alerta"}
                      </Badge>
                      <span className="text-sm font-medium">{alert.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(alert.created_at), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
