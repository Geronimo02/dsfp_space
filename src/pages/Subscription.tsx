import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

function StripePaymentSetup({ clientSecret, onSaved }: { clientSecret: string; onSaved: () => void }) {
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
      const { error: saveErr } = await supabase.functions.invoke("save-stripe-payment-method", { body: { payment_method_id: pmId } });
      if (saveErr) throw saveErr;
      toast.success("Método guardado");
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
  const { currentCompany } = useCompany();
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, company_id, plan_id, provider, status, trial_ends_at, current_period_end, provider_customer_id, mp_preapproval_id, stripe_payment_method_id")
        .eq("company_id", currentCompany!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: plan } = useQuery({
    queryKey: ["plan", subscription?.plan_id],
    enabled: !!subscription?.plan_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, price")
        .eq("id", subscription!.plan_id)
        .single();
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

  useEffect(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (key) {
      setStripePromise(loadStripe(key));
    }
  }, []);

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
            <p>Plan: <strong>{plan?.name ?? subscription?.plan_id ?? "-"}</strong></p>
            <p>Precio: ${plan?.price ?? "-"} USD/mes</p>
            <p>Estado: <strong>{subscription?.status ?? "-"}</strong></p>
            <p>Proveedor: {subscription?.provider ?? "-"}</p>
            <p>Trial resta: {trialDaysLeft ?? "-"} días</p>
            {nextBillingDate && <p>Próxima facturación: <strong>{nextBillingDate}</strong></p>}
            <p>MP preapproval: {subscription?.mp_preapproval_id ? "Autorizado" : "No autorizado"}</p>
            <p>Stripe PM: {subscription?.stripe_payment_method_id ? `Guardado (${subscription.stripe_payment_method_id.substring(0, 16)}...)` : "No guardado"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Método de pago</CardTitle>
            <CardDescription>Guardar tarjeta para cobro automático al fin del trial</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button variant="outline" onClick={setupMercadoPago}>Autorizar en Mercado Pago</Button>
            </div>
            <div className="space-y-2">
              <Button variant="outline" onClick={setupStripe}>Guardar tarjeta (Stripe)</Button>
            </div>
            {stripePromise && clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripePaymentSetup clientSecret={clientSecret} onSaved={() => setClientSecret(null)} />
              </Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
