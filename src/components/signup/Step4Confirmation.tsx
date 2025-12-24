import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { Loader2, Building2, Mail, User, CreditCard, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";

const MODULE_PRICE = 10;

// Format currency to 2 decimal places
const formatCurrency = (value: number) => value.toFixed(2);

const publishableKey = (import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined) || undefined;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function CardInput({ onConfirm, isLoading }: { onConfirm: (pmId: string) => void; isLoading: boolean }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    const numberEl = elements.getElement(CardNumberElement);
    if (!numberEl) return;

    try {
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: "card",
        card: numberEl,
      });
      if (error) throw error;
      if (!paymentMethod) throw new Error("No se pudo crear el método de pago");
      onConfirm(paymentMethod.id);
    } catch (e: any) {
      toast.error("Error al validar tarjeta: " + (e?.message ?? e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <Label className="mb-2 block">Número de tarjeta</Label>
          <div className="border rounded-lg p-3">
            <CardNumberElement options={{
              placeholder: "1234 1234 1234 1234",
              showIcon: true,
            }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-2 block">Vencimiento</Label>
            <div className="border rounded-lg p-3">
              <CardExpiryElement />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">CVC</Label>
            <div className="border rounded-lg p-3">
              <CardCvcElement />
            </div>
          </div>
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={!stripe || !elements || isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Procesando...
          </>
        ) : (
          "Confirmar y proceder al pago"
        )}
      </Button>
    </div>
  );
}

interface Step4ConfirmationProps {
  formData: SignupFormData;
  updateFormData: (data: Partial<SignupFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  onCreateIntent: () => Promise<void>;
}

export function Step4Confirmation({
  formData,
  updateFormData,
  nextStep,
  prevStep,
  onCreateIntent,
}: Step4ConfirmationProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);

  const { data: plan, isLoading: isPlanLoading } = useQuery({
    queryKey: ["plan", formData.plan_id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-plans", {
        body: {},
      });
      if (error) throw error;
      
      const plans = (data?.plans ?? []) as Array<{
        id: string;
        name: string;
        description: string | null;
        price: number;
        billing_period: string;
      }>;
      
      return plans.find(p => p.id === formData.plan_id) || null;
    },
    enabled: !!formData.plan_id,
  });

  const totalModulesCost = formData.modules.length * MODULE_PRICE;
  const baseCost = Number(plan?.price || 0);
  const totalCost = baseCost + totalModulesCost;
  const isFreeTrial = formData.plan_id === "460d1274-59bc-4c99-a815-c3c1d52d0803"; // FREE_PLAN_ID
  const isArgentina = (formData.country || "").toUpperCase() === "AR";

  const handleCardConfirm = async (pmId: string) => {
    try {
      setIsCreating(true);
      setPaymentMethodId(pmId);
      // Store payment method ID for backend processing
      updateFormData({ provider: "auto" as any, stripe_payment_method_id: pmId } as any);
      await onCreateIntent();
      nextStep();
    } catch (error) {
      console.error("Error creating intent:", error);
      toast.error(`Error al crear la suscripción: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Confirmar suscripción</h2>
        <p className="text-muted-foreground">Revisa tu información antes de continuar</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column - Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Información de cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{formData.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nombre:</span>
                <span className="font-medium">{formData.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Empresa:</span>
                <span className="font-medium">{formData.company_name}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Plan seleccionado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {isPlanLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">Plan:</span>
                    <div className="text-right">
                      <p className="font-medium">{plan?.name}</p>
                      <p className="text-xs text-muted-foreground">{plan?.description}</p>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precio base:</span>
                    <span className="font-medium">${formatCurrency(baseCost)} USD/mes</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {formData.modules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Módulos adicionales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {formData.modules.map((moduleId) => (
                    <div key={moduleId} className="flex justify-between text-sm">
                      <span className="capitalize">{moduleId}</span>
                      <span className="font-medium">${MODULE_PRICE} USD/mes</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Card Input or Summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen del pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan {plan?.name}:</span>
                  <span>${formatCurrency(baseCost)} USD</span>
                </div>
                {formData.modules.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Módulos ({formData.modules.length}):
                    </span>
                    <span>${formatCurrency(totalModulesCost)} USD</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total mensual:</span>
                  <span className="text-primary">${formatCurrency(totalCost)} USD</span>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-base mb-3 block">Datos de tarjeta</Label>
                {isFreeTrial ? (
                  <p className="text-xs text-muted-foreground mb-3">
                    Necesaria para activar tu período de prueba gratuito de 7 días. Después se cobrará el plan básico.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mb-3">
                    Procesado de forma segura con Stripe
                  </p>
                )}

                {!publishableKey && !isArgentina && (
                  <Alert className="mb-4">
                    <AlertTitle>Falta configurar Stripe</AlertTitle>
                    <AlertDescription>
                      Define la variable de entorno <strong>VITE_STRIPE_PUBLIC_KEY</strong> con tu clave publicable de Stripe.
                    </AlertDescription>
                  </Alert>
                )}

                {isArgentina ? (
                  <div className="border rounded-lg p-3">
                    <p className="text-sm">
                      Serás redirigido a Mercado Pago para autorizar el método de pago. No se cobrará ahora.
                    </p>
                  </div>
                ) : stripePromise ? (
                  <Elements stripe={stripePromise}>
                    <CardInput onConfirm={handleCardConfirm} isLoading={isCreating} />
                  </Elements>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button onClick={prevStep} variant="outline" size="lg" disabled={isCreating}>
          Atrás
        </Button>
      </div>
    </div>
  );
}
