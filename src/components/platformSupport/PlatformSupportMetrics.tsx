import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  BarChart3,
  Timer
} from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}

function MetricCard({ title, value, subtitle, icon, variant = "default" }: MetricCardProps) {
  const variantColors = {
    default: "text-foreground",
    success: "text-green-600",
    warning: "text-yellow-600",
    danger: "text-red-600",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${variantColors[variant]}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function PlatformSupportMetrics() {
  const { currentCompany } = useCompany();

  const { data: tickets } = useQuery({
    queryKey: ["platform-support-tickets-metrics", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await (supabase as any)
        .from("platform_support_tickets")
        .select("*")
        .eq("company_id", currentCompany.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Calculate metrics
  const stats = {
    total: tickets?.length || 0,
    open: tickets?.filter((t: any) => t.status === "open").length || 0,
    inProgress: tickets?.filter((t: any) => t.status === "in_progress").length || 0,
    waitingInfo: tickets?.filter((t: any) => t.waiting_for_customer).length || 0,
    resolved: tickets?.filter((t: any) => t.status === "resolved").length || 0,
    escalated: tickets?.filter((t: any) => t.escalated_at).length || 0,
    slaBreached: tickets?.filter((t: any) => 
      t.sla_response_breached || t.sla_resolution_breached
    ).length || 0,
  };

  // Calculate average response time
  const ticketsWithResponse = tickets?.filter((t: any) => t.first_response_at) || [];
  const avgResponseHours = ticketsWithResponse.length > 0
    ? ticketsWithResponse.reduce((acc: number, t: any) => {
        const created = new Date(t.created_at).getTime();
        const responded = new Date(t.first_response_at).getTime();
        return acc + (responded - created) / (1000 * 60 * 60);
      }, 0) / ticketsWithResponse.length
    : 0;

  // Calculate average resolution time
  const ticketsResolved = tickets?.filter((t: any) => t.resolved_at) || [];
  const avgResolutionHours = ticketsResolved.length > 0
    ? ticketsResolved.reduce((acc: number, t: any) => {
        const created = new Date(t.created_at).getTime();
        const resolved = new Date(t.resolved_at).getTime();
        return acc + (resolved - created) / (1000 * 60 * 60);
      }, 0) / ticketsResolved.length
    : 0;

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  // Category breakdown
  const categoryBreakdown = tickets?.reduce((acc: any, t: any) => {
    acc[t.category] = (acc[t.category] || 0) + 1;
    return acc;
  }, {}) || {};

  const categoryLabels: Record<string, string> = {
    technical: "🔧 Técnico",
    billing: "💰 Facturación",
    feature_request: "✨ Nueva función",
    bug: "🐛 Bug",
    account: "👤 Cuenta",
    other: "📋 Otro",
  };

  return (
    <div className="space-y-6">
      {/* Main metrics */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
        <MetricCard
          title="Abiertos"
          value={stats.open}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stats.open > 0 ? "warning" : "default"}
        />
        <MetricCard
          title="En Progreso"
          value={stats.inProgress}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          title="Esperando Info"
          value={stats.waitingInfo}
          subtitle="Pendiente de cliente"
          icon={<Timer className="h-4 w-4" />}
          variant="warning"
        />
        <MetricCard
          title="Resueltos"
          value={stats.resolved}
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant="success"
        />
        <MetricCard
          title="Tiempo Resp. Prom"
          value={formatHours(avgResponseHours)}
          subtitle="Primera respuesta"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          title="SLA Incumplidos"
          value={stats.slaBreached}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stats.slaBreached > 0 ? "danger" : "success"}
        />
      </div>

      {/* Category breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Tickets por Categoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(categoryBreakdown).map(([category, count]) => (
              <Badge key={category} variant="secondary" className="text-sm py-1 px-3">
                {categoryLabels[category] || category}: {count as number}
              </Badge>
            ))}
            {Object.keys(categoryBreakdown).length === 0 && (
              <span className="text-muted-foreground text-sm">
                No hay tickets aún
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
