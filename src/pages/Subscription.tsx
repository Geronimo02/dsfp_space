// subscription.tsx
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function getSubscriptionStatusLabel(status?: string) {
  const map: Record<string, string> = {
    active: "Activo",
    trialing: "En prueba",
    incomplete: "Pendiente de activación",
    past_due: "Pago pendiente",
    canceled: "Cancelado",
  };
  return status ? map[status] ?? status : "";
}

export default function Subscription() {
  const { currentCompany, loading: companyLoading } = useCompany();
  const [addingPayment, setAddingPayment] = useState(false);

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["subscription", currentCompany?.id],
    enabled: !companyLoading && !!currentCompany?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans (name, price)")
        .eq("company_id", currentCompany!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const trialDaysLeft = useMemo(() => {
    if (!subscription?.trial_ends_at) return null;
    const end = new Date(subscription.trial_ends_at).getTime();
    const now = Date.now();
    return Math.max(Math.ceil((end - now) / (1000 * 60 * 60 * 24)), 0);
  }, [subscription?.trial_ends_at]);

  const nextBillingDate = useMemo(() => {
    if (!subscription?.current_period_end) return null;
    return new Date(subscription.current_period_end).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [subscription?.current_period_end]);

  const { data: defaultPaymentMethod } = useQuery({
    queryKey: ["default-payment-method", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_payment_methods")
        .select("id, type, brand, last4, exp_month, exp_year, holder_name, mp_preapproval_id, is_default, created_at")
        .eq("company_id", currentCompany!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const startMercadoPagoFlow = async () => {
    setAddingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-preapproval", {
        body: { company_id: currentCompany!.id },
      });
      if (error) throw error;
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
        return;
      }
      throw new Error("No se obtuvo URL de autorización");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al iniciar configuración de pago");
    } finally {
      setAddingPayment(false);
    }
  };

  const addPaymentMethod = async () => {
    await startMercadoPagoFlow();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Suscripción</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Estado</CardTitle>
            <CardDescription>Plan y período de prueba</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {subscriptionLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                <div className="h-4 w-36 bg-muted animate-pulse rounded" />
                <div className="h-4 w-44 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <>
                <p>
                  Plan:{" "}
                  <strong>{subscription?.subscription_plans?.name ?? (subscription?.plan_id ? "Plan sin nombre" : "Sin plan")}</strong>
                </p>
                <p>Precio: ${subscription?.subscription_plans?.price ?? "-"} USD/mes</p>
                <p>
                  Estado: <strong>{getSubscriptionStatusLabel(subscription?.status) || ""}</strong>
                </p>
                {trialDaysLeft !== null && trialDaysLeft > 0 && <p>Trial resta: {trialDaysLeft} días</p>}
                {nextBillingDate && (
                  <p>
                    Próxima facturación: <strong>{nextBillingDate}</strong>
                  </p>
                )}
                <p>
                  Método guardado:{" "}
                  {defaultPaymentMethod
                    ? defaultPaymentMethod.type === "card"
                      ? `${defaultPaymentMethod.brand?.toUpperCase() ?? "Tarjeta"} •••• ${defaultPaymentMethod.last4}`
                      : "Mercado Pago"
                    : "No guardado"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Método de pago</CardTitle>
            <CardDescription>Agregar una tarjeta para cobro automático</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button variant="outline" onClick={addPaymentMethod} disabled={addingPayment}>
                {addingPayment ? "Redirigiendo..." : "Agregar tarjeta"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
