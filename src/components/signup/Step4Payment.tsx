import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, ArrowRight, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StripeCardFields } from "./StripeCardFields";
import { MercadoPagoCardFields } from "./MercadoPagoCardFields";

interface Step4PaymentProps {
  formData: SignupFormData;
  updateFormData: (data: Partial<SignupFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

const COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "US", name: "Estados Unidos" },
  { code: "MX", name: "México" },
  { code: "BR", name: "Brasil" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "ES", name: "España" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "OTHER", name: "Otro" },
];

export function Step4Payment({ formData, updateFormData, nextStep, prevStep }: Step4PaymentProps) {
  const [billingCountry, setBillingCountry] = useState<string>(formData.billing_country || "AR");
  const [stripePromise] = useState(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    return key ? loadStripe(key) : null;
  });
  const [loading, setLoading] = useState(false);
  const [planPrice, setPlanPrice] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Fetch plan details
  useEffect(() => {
    const fetchPlan = async () => {
      if (!formData.plan_id) {
        setLoadingPlan(false);
        return;
      }
      
      setLoadingPlan(true);
      try {
        const { data, error } = await supabase.functions.invoke("list-plans");
        
        if (error) throw error;
        
        const plans = data?.plans || [];
        const selectedPlan = plans.find((p: any) => p.id === formData.plan_id);
        
        if (selectedPlan) {
          setPlanPrice(selectedPlan.price);
        }
      } catch (err) {
        console.error("Error fetching plan:", err);
      } finally {
        setLoadingPlan(false);
      }
    };
    
    fetchPlan();
  }, [formData.plan_id]);

  const isArgentina = billingCountry === "AR";
  const provider = isArgentina ? "mercadopago" : "stripe";
  const planAmountARS = planPrice ? Math.round(planPrice * 1000) : 0; // Convert USD to ARS

  const handlePaymentSuccess = async (paymentMethodRef: string, metadata: { brand: string; last4: string; exp_month: number; exp_year: number; payment_method_id?: string; issuer_id?: number }) => {
    setLoading(true);
    console.log("[Step4Payment] handlePaymentSuccess received metadata:", JSON.stringify(metadata, null, 2));
    try {
      // Save payment method to staging table (will charge in Step 5)
      const requestBody = {
        email: formData.email,
        name: formData.full_name,
        billing_country: billingCountry,
        provider: provider,
        payment_method_ref: paymentMethodRef,
        brand: metadata.brand,
        last4: metadata.last4,
        exp_month: metadata.exp_month,
        exp_year: metadata.exp_year,
        plan_id: formData.plan_id,
        // MP-specific fields
        payment_method_id: metadata.payment_method_id,
        issuer_id: metadata.issuer_id,
      };
      
      console.log("[Step4Payment] Sending to signup-save-payment-method:", JSON.stringify(requestBody, null, 2));
      
      const { data, error } = await supabase.functions.invoke("signup-save-payment-method", {
        body: requestBody,
      });

      if (error) throw error;

      console.log("[Step4Payment] Payment method saved, will charge in Step 5");
      
      updateFormData({
        payment_provider: provider,
        payment_method_ref: paymentMethodRef,
        billing_country: billingCountry,
        payment_method_last4: metadata.last4,
        payment_method_brand: metadata.brand,
      });

      toast.success("Método de pago guardado. Procede al siguiente paso.");
      nextStep();
    } catch (e: any) {
      console.error("[Step4Payment] Payment error:", e);
      toast.error(e?.message ?? "Error al procesar el método de pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Método de pago</h2>
        <p className="text-muted-foreground">Agrega tu tarjeta para comenzar después del período de prueba</p>
      </div>

      {/* Country Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle>País de facturación</CardTitle>
          <CardDescription>Selecciona tu país para procesamiento de pago</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="country">País</Label>
            <Select value={billingCountry} onValueChange={setBillingCountry} disabled={loading}>
              <SelectTrigger id="country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payment Card - Same UI for both providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Datos de la tarjeta
          </CardTitle>
          <CardDescription>Ingresa tu tarjeta de crédito o débito</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPlan ? (
            // Loading plan details
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Cargando información del plan...
            </div>
          ) : isArgentina ? (
            // Mercado Pago form - same layout as Stripe
            <MercadoPagoCardFields
              onSuccess={handlePaymentSuccess}
              isLoading={loading}
              email={formData.email}
              planId={formData.plan_id || ""}
              planAmount={planAmountARS}
            />
          ) : !stripePromise ? (
            // Stripe not configured
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Stripe no configurado</AlertTitle>
              <AlertDescription>
                La variable de entorno <code className="text-sm font-mono">VITE_STRIPE_PUBLIC_KEY</code> no está configurada.
                Contacta al administrador.
              </AlertDescription>
            </Alert>
          ) : (
            // Stripe form - same layout as Mercado Pago (no intermediate button)
            <Elements stripe={stripePromise}>
              <StripeCardFields
                onSuccess={handlePaymentSuccess}
                isLoading={loading}
                email={formData.email}
                planId={formData.plan_id || ""}
              />
            </Elements>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={prevStep} disabled={loading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Anterior
        </Button>
      </div>
    </div>
  );
}
