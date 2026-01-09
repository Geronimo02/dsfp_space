import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

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

function StripePaymentSetup({ clientSecret, onSaved, companyId, onInvalidate }: { clientSecret: string; onSaved: () => void; companyId: string; onInvalidate: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSaving(true);
    try {
      const { setupIntent, error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });
      if (error) throw error;
      const pmId = (setupIntent?.payment_method as string) || "";
      const { error: saveErr } = await supabase.functions.invoke("save-stripe-payment-method", { body: { payment_method_id: pmId, company_id: companyId } });
      if (saveErr) throw saveErr;
      toast.success("Método guardado");
      onInvalidate();
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al guardar tarjeta: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      <Button onClick={handleSubmit} disabled={saving || !stripe || !elements}>
        {saving ? "Guardando..." : "Guardar tarjeta"}
      </Button>
    </div>
  );
}

export default function Subscription() {
  const { currentCompany, loading: companyLoading } = useCompany();
  const queryClient = useQueryClient();
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["subscription", currentCompany?.id],
    enabled: !companyLoading && !!currentCompany?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      console.log("Fetching subscription for", currentCompany?.id);
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans (name, price)")
        .eq("company_id", currentCompany!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fallback to company country when provider is missing
  const { data: companyCountry } = useQuery({
    queryKey: ["company-country", currentCompany?.id],
    enabled: !!currentCompany?.id && !subscription?.provider,
    queryFn: async () => {
      console.log("Fetching subscription for", currentCompany?.id);
      const { data, error } = await supabase
        .from("companies")
        .select("country")
        .eq("id", currentCompany!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.country as string | null;
    },
  });

  const effectiveProvider = useMemo(() => {
    const prov = subscription?.provider?.toLowerCase();
    if (prov === "stripe" || prov === "mercadopago") return prov;
    const country = (companyCountry || "").toUpperCase();
    return country === "AR" ? "mercadopago" : "stripe";
  }, [subscription?.provider, companyCountry]);

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

  useEffect(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (key) {
      setStripePromise(loadStripe(key));
    }
  }, []);

  const { data: defaultPaymentMethod } = useQuery({
    queryKey: ["default-payment-method", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      console.log("Fetching subscription for", currentCompany?.id);
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

  const setupStripe = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-setup-intent", {
        body: { company_id: currentCompany!.id },
      });
      if (error) throw error;
      if (!data?.client_secret) throw new Error("Sin client_secret");
      setClientSecret(data.client_secret);
    } catch (e: any) {
      console.error(e);
      toast.error("Error iniciando setup de Stripe: " + (e?.message ?? e));
    }
  };

  const setupMercadoPago = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-mp-preapproval", {
        body: { company_id: currentCompany!.id },
      });
      if (error) throw error;
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        toast.error("No se obtuvo URL de autorización");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Error iniciando autorización en MP: " + (e?.message ?? e));
    }
  };

  // Single entry point: decide provider and start corresponding flow
  const addPaymentMethod = async () => {
    const provider = effectiveProvider;
    if (provider === "stripe") {
      await setupStripe();
    } else if (provider === "mercadopago") {
      await setupMercadoPago();
    } else {
      toast.error("Proveedor de pago inválido");
    }
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
                <p>Plan: <strong>{subscription?.subscription_plans?.name ?? (subscription?.plan_id ? "Plan sin nombre" : "Sin plan")}</strong></p>
                <p>Precio: ${subscription?.subscription_plans?.price ?? "-"} USD/mes</p>
                <p>Estado: <strong>{getSubscriptionStatusLabel(subscription?.status) || ""}</strong></p>
                <p>Proveedor: {subscription?.provider ?? effectiveProvider ?? "-"}</p>
                {trialDaysLeft !== null && trialDaysLeft > 0 && (
                  <p>Trial resta: {trialDaysLeft} días</p>
                )}
                {nextBillingDate && <p>Próxima facturación: <strong>{nextBillingDate}</strong></p>}
                <p>Método guardado: {defaultPaymentMethod
                  ? defaultPaymentMethod.type === "card"
                    ? `${defaultPaymentMethod.brand?.toUpperCase() ?? "Tarjeta"} •••• ${defaultPaymentMethod.last4}`
                    : "Mercado Pago"
                  : "No guardado"}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Método de pago</CardTitle>
            <CardDescription>Agregar una tarjeta para cobro automático según tu país</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button variant="outline" onClick={addPaymentMethod}>Agregar tarjeta</Button>
            </div>
            {stripePromise && clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripePaymentSetup
                  clientSecret={clientSecret}
                  companyId={currentCompany!.id}
                  onInvalidate={() => {
                    queryClient.invalidateQueries({ queryKey: ["default-payment-method", currentCompany?.id] });
                    queryClient.invalidateQueries({ queryKey: ["subscription", currentCompany?.id] });
                  }}
                  onSaved={() => setClientSecret(null)}
                />
              </Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
