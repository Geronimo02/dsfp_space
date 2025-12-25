import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Step3PaymentProps {
  formData: SignupFormData;
  updateFormData: (data: Partial<SignupFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

function PaymentMethodForm({
  onSuccess,
  onSkip,
}: {
  onSuccess: (paymentMethodId: string) => void;
  onSkip: () => void;
}) {
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
      if (!pmId) throw new Error("No se obtuvo payment method ID");

      toast.success("Tarjeta guardada exitosamente");
      onSuccess(pmId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al guardar la tarjeta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      <div className="flex gap-3 justify-between">
        <Button type="button" variant="ghost" onClick={onSkip}>
          Saltar por ahora
        </Button>
        <Button type="submit" disabled={saving || !stripe || !elements}>
          {saving ? "Guardando..." : "Guardar y continuar"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

export function Step3Payment({ formData, updateFormData, nextStep, prevStep }: Step3PaymentProps) {
  const [stripePromise] = useState(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    return key ? loadStripe(key) : null;
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);

  const handleSetupPayment = async () => {
    setLoading(true);
    try {
      // Create a temporary setup intent for signup (before company exists)
      const { data, error } = await supabase.functions.invoke("create-signup-setup-intent", {
        body: { 
          email: formData.email,
          name: formData.full_name 
        },
      });

      if (error) throw error;
      if (!data?.client_secret) throw new Error("No se pudo crear el setup intent");

      setClientSecret(data.client_secret);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al configurar el pago");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (paymentMethodId: string) => {
    updateFormData({ stripe_payment_method_id: paymentMethodId });
    setPaymentSaved(true);
    setTimeout(() => nextStep(), 500);
  };

  const handleSkip = () => {
    nextStep();
  };

  const handleAddMercadoPago = () => {
    toast.info("Mercado Pago se configurará después de completar el registro");
    updateFormData({ provider: "mercadopago" });
    nextStep();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Método de pago</h2>
        <p className="text-muted-foreground">
          Añade una tarjeta para comenzar después del período de prueba (puedes saltear este paso)
        </p>
      </div>

      {paymentSaved ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-green-900">Tarjeta guardada exitosamente</h3>
                <p className="text-sm text-green-700">Continuando al siguiente paso...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {!clientSecret ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleSetupPayment}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Tarjeta de Crédito/Débito
                  </CardTitle>
                  <CardDescription>Visa, Mastercard, American Express</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button disabled={loading} className="w-full">
                    {loading ? "Cargando..." : "Añadir tarjeta"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleAddMercadoPago}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500" />
                    Mercado Pago
                  </CardTitle>
                  <CardDescription>Configura después del registro</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Seleccionar Mercado Pago
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Ingresa los datos de tu tarjeta</CardTitle>
                <CardDescription>
                  Tus datos están protegidos y encriptados de forma segura
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stripePromise && clientSecret && (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentMethodForm onSuccess={handlePaymentSuccess} onSkip={handleSkip} />
                  </Elements>
                )}
              </CardContent>
            </Card>
          )}

          {!clientSecret && (
            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={prevStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Anterior
              </Button>
              <Button variant="outline" onClick={handleSkip}>
                Saltar por ahora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
