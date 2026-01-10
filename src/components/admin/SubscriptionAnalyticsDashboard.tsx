// src/components/admin/SubscriptionAnalyticsDashboard.tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Users, DollarSign } from "lucide-react";
import { format } from "date-fns";

export function SubscriptionAnalyticsDashboard() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["subscription-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-subscription-analytics");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return <div className="grid gap-4">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${analytics?.metrics?.mrr || "0"}</p>
            <p className="text-xs text-green-600 mt-1">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.metrics?.active_subscriptions || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Paid subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Churn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.metrics?.churn_rate_30d || "0"}%</p>
            <p className="text-xs text-red-600 mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trials</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics?.metrics?.trialing_subscriptions || 0}</p>
            <p className="text-xs text-blue-600 mt-1">Active trials</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {analytics?.alerts?.at_risk_count > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold">{analytics.alerts.at_risk_count} subscripciones en riesgo</p>
            <p className="text-sm mt-1">Pagos fallidos o estado crítico</p>
          </AlertDescription>
        </Alert>
      )}

      {/* At-Risk Subscriptions */}
      {analytics?.alerts?.at_risk_subscriptions?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Subscripciones en Riesgo
            </CardTitle>
            <CardDescription>Requieren atención inmediata</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.alerts.at_risk_subscriptions.map((sub: any) => (
                <div key={sub.id} className="p-3 border rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{(sub.companies as any)?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: <Badge variant="destructive">{sub.status}</Badge>
                      {sub.payment_failed_count > 0 && ` • Failed: ${sub.payment_failed_count}x`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiring Trials */}
      {analytics?.alerts?.expiring_trials_count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
              Pruebas Venciendo Pronto
            </CardTitle>
            <CardDescription>Próximos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.alerts.expiring_trials.map((trial: any) => (
                <div key={trial.id} className="p-3 border rounded-lg">
                  <p className="font-semibold">{(trial.companies as any)?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Expira: {format(new Date(trial.trial_ends_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>Últimos cambios en suscripciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Upgrades (últimos 30 días)</span>
              <Badge>{analytics?.activity?.upgrades_30d || 0}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>Downgrades (últimos 30 días)</span>
              <Badge variant="outline">{analytics?.activity?.downgrades_30d || 0}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
