import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { PaymentMethodsManager } from "./PaymentMethodsManager";

interface Subscription {
  id: string;
  company_id: string;
  plan_id: string;
  provider: string;
  status: string;
  trial_ends_at: string | null;
  provider_customer_id: string | null;
  mp_preapproval_id: string | null;
  stripe_payment_method_id: string | null;
}

export function SubscriptionSettings() {
  const { currentCompany } = useCompany();

  const { data: subscription } = useQuery<Subscription | null>({
    queryKey: ["subscription", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "id, company_id, plan_id, provider, status, trial_ends_at, provider_customer_id, mp_preapproval_id, stripe_payment_method_id"
        )
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

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Estado de Suscripción
          </CardTitle>
          <CardDescription>Información de tu plan y período de prueba</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Plan</p>
              <p className="text-lg font-semibold">{subscription?.plan_id ?? "Sin plan"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Proveedor</p>
              <p className="text-lg font-semibold capitalize">{subscription?.provider ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Prueba gratuita</p>
              <p className="text-lg font-semibold">
                {trialDaysLeft !== null ? `${trialDaysLeft} días restantes` : "No activa"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estado</p>
              <p className="text-lg font-semibold capitalize">{subscription?.status ?? "Inactivo"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <PaymentMethodsManager companyId={currentCompany?.id} />
    </div>
  );
}
