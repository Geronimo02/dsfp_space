import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface PaymentMethod {
  id: string;
  type: "card" | "mercadopago";
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  holder_name?: string;
  is_default: boolean;
  created_at: string;
  mp_preapproval_id?: string;
}

interface StripePaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  companyId: string;
}

function StripePaymentForm({ 
  clientSecret, 
  onSuccess,
  companyId,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      
      const { error: saveErr } = await supabase.functions.invoke("save-stripe-payment-method", { 
        body: { payment_method_id: pmId, company_id: companyId } 
      });
      
      if (saveErr) throw saveErr;

      toast.success("Tarjeta guardada exitosamente");
      onSuccess();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al guardar la tarjeta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2 justify-end">
        <Button type="submit" disabled={saving || !stripe || !elements}>
          {saving ? "Guardando..." : "Guardar tarjeta"}
        </Button>
      </div>
    </form>
  );
}

export function PaymentMethodsManager({ 
  companyId,
  showTitle = true,
  compact = false
}: { 
  companyId?: string;
  showTitle?: boolean;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [stripePromise] = useState(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    return key ? loadStripe(key) : null;
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Fetch payment methods
  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ["payment-methods", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("company_payment_methods")
        .select("*")
        .eq("company_id", companyId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as PaymentMethod[];
    },
  });

  // Fetch subscription to decide provider
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["subscription", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans (id, name, price, description)")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data as { provider?: string; plan_id?: string; status?: string; subscription_plans?: { id: string; name: string; price: number; description: string } } | null;
    },
  });

  const { data: defaultPaymentMethod } = useQuery({
    queryKey: ["default-payment-method", companyId],
    enabled: !!companyId && !subscriptionLoading && !subscription?.provider,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_payment_methods")
        .select("billing_country, type")
        .eq("company_id", companyId!)
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      return data as { billing_country?: string | null; type?: string } | null;
    },
  });

  const effectiveProvider = useMemo(() => {
    const prov = subscription?.provider?.toLowerCase();
    if (prov === "stripe" || prov === "mercadopago") return prov;
    const country = (defaultPaymentMethod?.billing_country || "").toUpperCase();
    return country === "AR" ? "mercadopago" : "stripe";
  }, [subscription?.provider, defaultPaymentMethod?.billing_country]);

  const handleAddCard = async () => {
    try {
      if (effectiveProvider === "mercadopago") {
        const { data, error } = await supabase.functions.invoke("create-mp-preapproval", {
          body: { company_id: companyId },
        });
        if (error) throw error;
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        }
        throw new Error("No se obtuvo URL de autorización");
      }

      const { data, error } = await supabase.functions.invoke("create-stripe-setup-intent", {
        body: { company_id: companyId },
      });
      if (error) throw error;
      if (!data?.client_secret) throw new Error("No se pudo crear el setup intent");
      setClientSecret(data.client_secret);
      setAddDialogOpen(true);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al iniciar configuración de pago");
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      const { error } = await supabase
        .from("company_payment_methods")
        .update({ is_default: false })
        .eq("company_id", companyId!);

      if (error) throw error;

      const { error: err2 } = await supabase
        .from("company_payment_methods")
        .update({ is_default: true })
        .eq("id", methodId);

      if (err2) throw err2;

      await queryClient.invalidateQueries({ queryKey: ["payment-methods", companyId] });
      toast.success("Método de pago predeterminado actualizado");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al establecer método predeterminado");
    }
  };

  const handleDelete = async (methodId: string) => {
    try {
      const { error } = await supabase.functions.invoke("delete-payment-method", {
        body: { method_id: methodId },
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["payment-methods", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["subscription", companyId] });
      toast.success("Método de pago eliminado");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al eliminar método de pago");
    }
  };

  const getCardBrandIcon = (brand?: string) => {
    const b = (brand ?? "").toLowerCase();
    if (b.includes("visa")) return "💳";
    if (b.includes("master")) return "💳";
    if (b.includes("amex")) return "💳";
    return "💳";
  };

  if (!companyId) {
    return (
      <Card className="shadow-soft">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <p>No hay empresa seleccionada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {showTitle && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Tus tarjetas de pago</h3>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={handleAddCard}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir tarjeta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Añadir tarjeta de crédito o débito</DialogTitle>
                <DialogDescription>
                  Ingresa los datos de tu tarjeta de forma segura
                </DialogDescription>
              </DialogHeader>
              {effectiveProvider === "stripe" && stripePromise && clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripePaymentForm
                    clientSecret={clientSecret}
                    companyId={companyId!}
                    onSuccess={() => {
                      setAddDialogOpen(false);
                      setClientSecret(null);
                      queryClient.invalidateQueries({ queryKey: ["payment-methods", companyId] });
                    }}
                  />
                </Elements>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24 bg-muted" />
            </Card>
          ))}
        </div>
      ) : paymentMethods && paymentMethods.length > 0 ? (
        <div className="grid gap-3">
          {paymentMethods.map((method) => (
            <Card
              key={method.id}
              className={cn(
                "transition-all hover:shadow-md cursor-pointer",
                method.is_default && "border-primary bg-primary/5"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white text-2xl">
                      {getCardBrandIcon(method.brand)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">
                          {method.brand?.charAt(0).toUpperCase() + method.brand?.slice(1).toLowerCase() ?? "Tarjeta"} •••• {method.last4 ?? "****"}
                        </p>
                        {method.is_default && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Predeterminada
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {method.holder_name && `${method.holder_name} • `}
                        {method.exp_month && method.exp_year 
                          ? `Vence ${String(method.exp_month).padStart(2, '0')}/${method.exp_year}`
                          : `Autorizado • ${new Date(method.created_at).toLocaleDateString()}`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.is_default && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetDefault(method.id);
                        }}
                      >
                        Establecer predeterminada
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("¿Eliminar este método de pago?")) {
                          handleDelete(method.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="rounded-full bg-muted p-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">No tienes tarjetas guardadas</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Añade una tarjeta para facilitar tus pagos
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleAddCard}>
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir tarjeta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
