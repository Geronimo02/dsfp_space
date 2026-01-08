import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, ArrowRight, ArrowLeft, AlertCircle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { StripeCardFields } from "./StripeCardFields";
import { MercadoPagoCardFields } from "./MercadoPagoCardFields";

interface Step4CombinedProps {
  formData: SignupFormData;
  updateFormData: (data: Partial<SignupFormData>) => void;
  onSuccess: () => void;
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

const MODULE_PRICE = 10;

type ProcessingStage = "idle" | "payment_method" | "finalizing" | "success" | "error";

export function Step4Combined({ formData, updateFormData, onSuccess, prevStep }: Step4CombinedProps) {
  const [billingCountry, setBillingCountry] = useState<string>(formData.billing_country || "AR");
  const [stripePromise] = useState(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    return key ? loadStripe(key) : null;
  });
  const [planPrice, setPlanPrice] = useState<number | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [paymentMethodRef, setPaymentMethodRef] = useState<string>("");

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
  const planAmountARS = planPrice ? Math.round(planPrice * 1000) : 0;
  const totalModulesCost = formData.modules.length * MODULE_PRICE;
  const baseCost = planPrice || 0;
  const totalCost = baseCost + totalModulesCost;

  // Handle payment method tokenization (Step 4 Part 1)
  const handlePaymentMethodSaved = async (
    paymentRef: string,
    metadata: { brand: string; last4: string; exp_month: number; exp_year: number; payment_method_id?: string; issuer_id?: number }
  ) => {
    console.log("[Step4Combined] Payment method tokenized, saving...");
    setProcessingStage("payment_method");
    setPaymentMethodRef(paymentRef);

    try {
      // Save payment method to staging with all account info
      const requestBody = {
        email: formData.email,
        name: formData.full_name,
        billing_country: billingCountry,
        provider: provider,
        payment_method_ref: paymentRef,
        brand: metadata.brand,
        last4: metadata.last4,
        exp_month: metadata.exp_month,
        exp_year: metadata.exp_year,
        plan_id: formData.plan_id,
        payment_method_id: metadata.payment_method_id,
        issuer_id: metadata.issuer_id,
        // Add account info for finalize-signup to use
        full_name: formData.full_name,
        company_name: formData.company_name,
        modules: formData.modules,
      };

      const { data, error } = await supabase.functions.invoke("signup-save-payment-method", {
        body: requestBody,
      });

      if (error) throw error;

      console.log("[Step4Combined] Payment method saved");
      toast.success("Tarjeta validada. Procediendo con la confirmación...");

      // Move to finalization stage (Step 4 Part 2)
      await handleFinalizeSignup(paymentRef);
    } catch (e: any) {
      console.error("[Step4Combined] Error:", e);
      setErrorMessage(e?.message ?? "Error al procesar el método de pago");
      setProcessingStage("error");
      toast.error(e?.message ?? "Error al procesar el método de pago");
    }
  };

  // Handle account creation and payment (Step 4 Part 2)
  const handleFinalizeSignup = async (paymentRef: string) => {
    console.log("[Step4Combined] Finalizing signup with payment...");
    setProcessingStage("finalizing");
    setErrorMessage("");

    try {
      // 1) Crear (o reutilizar) un signup_intent real para no depender del plan_id
      let intentId = typeof window !== "undefined" ? localStorage.getItem("signup_intent_id") : null;

      if (!intentId) {
        console.log("[Step4Combined] No intent en cache, creando...", {
          email: formData.email,
          plan_id: formData.plan_id,
          provider,
          paymentRef,
        });

        const { data, error } = await supabase.functions.invoke("create-intent", {
          body: {
            email: formData.email,
            full_name: formData.full_name,
            company_name: formData.company_name,
            plan_id: formData.plan_id,
            modules: formData.modules,
            provider,
            payment_provider: provider,
            payment_method_ref: paymentRef,
            billing_country: billingCountry,
          },
        });

        if (error || !data?.intent_id) {
          console.error("[Step4Combined] Error creando intent:", error || data);
          throw new Error("No se pudo crear el intento de registro");
        }

        intentId = data.intent_id;
        localStorage.setItem("signup_intent_id", intentId);
        console.log("[Step4Combined] Intent creado y guardado:", intentId);
      }

      // Call finalize-signup to charge payment and create account
      const { data, error } = await supabase.functions.invoke("finalize-signup", {
        body: {
          intent_id: intentId,
          password: formData.password,
        },
      });

      if (error) {
        console.error("[Step4Combined] finalize-signup error:", error);
        let errorMsg = "No pudimos procesar tu tarjeta. Verifica los datos y que tengas fondos disponibles";

        if ((error as any)?.context?.response) {
          try {
            const response = (error as any).context.response;
            const parsed = typeof response === "string" ? JSON.parse(response) : response;
            if (parsed.error) {
              errorMsg = parsed.error;
            }
          } catch (e) {
            console.error("[Step4Combined] Could not parse error:", e);
          }
        }

        setErrorMessage(errorMsg);
        setProcessingStage("error");
        toast.error(errorMsg);
        return;
      }

      if (data?.error) {
        console.error("[Step4Combined] finalize-signup returned error:", data.error);
        setErrorMessage(data.error);
        setProcessingStage("error");
        toast.error(data.error);
        return;
      }

      console.log("[Step4Combined] ✅ Signup finalized successfully");
      setProcessingStage("success");

      // Update form data
      updateFormData({
        payment_provider: provider,
        payment_method_ref: paymentRef,
        billing_country: billingCountry,
      });

      toast.success("¡Cuenta creada exitosamente!");

      // Clear localStorage
      localStorage.removeItem("signup_wizard_data");
      localStorage.removeItem("signup_intent_id");

      // Call success callback
      setTimeout(onSuccess, 2000);
    } catch (err: any) {
      console.error("[Step4Combined] Unexpected error:", err);
      setErrorMessage(err?.message || "Error inesperado");
      setProcessingStage("error");
      toast.error(err?.message || "Error inesperado");
    }
  };

  // Render different UI based on processing stage
  if (processingStage === "success") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4 py-12">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold">¡Bienvenido a RetailSnap Pro!</h2>
            <p className="text-muted-foreground mt-2">Tu cuenta ha sido creada exitosamente</p>
          </div>
          <Button onClick={onSuccess} className="mt-6">
            Ir al dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (processingStage === "error") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <div>
            <h2 className="text-2xl font-bold">Error al procesar el pago</h2>
            <p className="text-muted-foreground mt-2">{errorMessage}</p>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={() => setProcessingStage("idle")} className="flex-1">
            Intentar de nuevo
          </Button>
          <Button variant="outline" onClick={prevStep} className="flex-1">
            Volver atrás
          </Button>
        </div>
      </div>
    );
  }

  if (processingStage === "finalizing") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4 py-12">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <div>
            <h2 className="text-xl font-bold">Procesando pago...</h2>
            <p className="text-muted-foreground mt-2">Por favor espera mientras finalizamos tu registro</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Confirmación y pago</h2>
        <p className="text-muted-foreground">Revisa tu información y completa el pago</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - Summary */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan:</span>
                <span className="font-medium">${planPrice?.toFixed(2)} USD/mes</span>
              </div>
              {formData.modules.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Módulos ({formData.modules.length}):</span>
                  <span className="font-medium">${totalModulesCost} USD/mes</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total:</span>
                <span className="text-primary">${totalCost?.toFixed(2)} USD</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{formData.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Empresa</p>
                <p className="font-medium">{formData.company_name}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Payment Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Country Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">País de facturación</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={billingCountry} onValueChange={setBillingCountry} disabled={processingStage !== "idle"}>
                <SelectTrigger>
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
            </CardContent>
          </Card>

          {/* Payment Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5" />
                Datos de la tarjeta
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPlan ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Cargando...
                </div>
              ) : isArgentina ? (
                <MercadoPagoCardFields
                  onSuccess={handlePaymentMethodSaved}
                  isLoading={processingStage !== "idle"}
                  email={formData.email}
                  planId={formData.plan_id || ""}
                  planAmount={planAmountARS}
                />
              ) : !stripePromise ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Stripe no configurado</AlertTitle>
                </Alert>
              ) : (
                <Elements stripe={stripePromise}>
                  <StripeCardFields
                    onSuccess={handlePaymentMethodSaved}
                    isLoading={processingStage !== "idle"}
                    email={formData.email}
                    planId={formData.plan_id || ""}
                  />
                </Elements>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={prevStep} disabled={processingStage !== "idle"}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Atrás
        </Button>
      </div>
    </div>
  );
}
