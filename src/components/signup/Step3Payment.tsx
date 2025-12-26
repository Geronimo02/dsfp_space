import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Step3PaymentProps {
  formData: SignupFormData;
  updateFormData: (data: Partial<SignupFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

// Country list (simplified, can expand)
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

// Stripe form component (only shown for non-AR countries)
function StripePaymentForm({
  clientSecret,
  onSuccess,
  onSkip,
  isLoading,
}: {
  clientSecret: string;
  onSuccess: (paymentMethodId: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || saving) return;

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

      onSuccess(pmId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al guardar la tarjeta");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      <div className="flex gap-3 justify-between">
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving || isLoading}>
          Saltar por ahora
        </Button>
        <Button type="submit" disabled={saving || isLoading || !stripe || !elements}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              Guardar y continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// MP Card Form placeholder (simplified - in production use MP Bricks or SDK)
function MercadoPagoForm({
  onSuccess,
  onSkip,
  isLoading,
}: {
  onSuccess: (token: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [cardData, setCardData] = useState({
    number: "",
    expiry: "",
    cvc: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || isLoading) return;

    setSaving(true);
    try {
      if (!cardData.number || !cardData.expiry || !cardData.cvc) {
        throw new Error("Por favor completa todos los campos");
      }

      // In production: use MP SDK to tokenize
      // For now, generate a mock token that will be validated by backend
      const mockToken = `mp_tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      onSuccess(mockToken);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al procesar la tarjeta");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="card-number">Número de tarjeta</Label>
        <input
          id="card-number"
          type="text"
          placeholder="1234 5678 9012 3456"
          maxLength={19}
          value={cardData.number}
          onChange={(e) => setCardData({ ...cardData, number: e.target.value.replace(/\D/g, "").replace(/(\d{4})/g, "$1 ").trim() })}
          className="w-full px-3 py-2 border rounded-md"
          disabled={saving || isLoading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expiry">Vencimiento (MM/YY)</Label>
          <input
            id="expiry"
            type="text"
            placeholder="12/25"
            maxLength={5}
            value={cardData.expiry}
            onChange={(e) => {
              let val = e.target.value.replace(/\D/g, "");
              if (val.length >= 2) val = val.slice(0, 2) + "/" + val.slice(2, 4);
              setCardData({ ...cardData, expiry: val });
            }}
            className="w-full px-3 py-2 border rounded-md"
            disabled={saving || isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvc">CVC</Label>
          <input
            id="cvc"
            type="text"
            placeholder="123"
            maxLength={4}
            value={cardData.cvc}
            onChange={(e) => setCardData({ ...cardData, cvc: e.target.value.replace(/\D/g, "") })}
            className="w-full px-3 py-2 border rounded-md"
            disabled={saving || isLoading}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Los datos de tu tarjeta están protegidos y encriptados de forma segura.
      </div>

      <div className="flex gap-3 justify-between">
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving || isLoading}>
          Saltar por ahora
        </Button>
        <Button type="submit" disabled={saving || isLoading}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              Guardar y continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function Step3Payment({ formData, updateFormData, nextStep, prevStep }: Step3PaymentProps) {
  const [billingCountry, setBillingCountry] = useState<string>(formData.billing_country || "AR");
  const [stripePromise] = useState(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    return key ? loadStripe(key) : null;
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);

  const provider = billingCountry === "AR" ? "mercadopago" : "stripe";
  const isStripe = provider === "stripe";

  const handleInitializePayment = async () => {
    setLoading(true);
    try {
      if (isStripe) {
        // Create Stripe setup intent
        const { data, error } = await supabase.functions.invoke("create-signup-setup-intent", {
          body: {
            email: formData.email,
            name: formData.full_name,
          },
        });

        if (error) throw error;
        if (!data?.client_secret) throw new Error("No se pudo crear el setup intent");

        setClientSecret(data.client_secret);
      }
      // MP doesn't need setup, form is shown directly
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al configurar el pago");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentMethodRef: string) => {
    try {
      // Call unified edge function to save payment method
      const { data, error } = await supabase.functions.invoke("signup-save-payment-method", {
        body: {
          email: formData.email,
          name: formData.full_name,
          billing_country: billingCountry,
          provider,
          payment_method_ref: paymentMethodRef,
        },
      });

      if (error) throw error;

      // Save to form data
      updateFormData({
        payment_provider: provider,
        payment_method_ref: paymentMethodRef,
        billing_country: billingCountry,
        payment_method_last4: data?.last4,
        payment_method_brand: data?.brand,
      });

      setPaymentSaved(true);
      toast.success("Tarjeta guardada exitosamente");
      setTimeout(() => nextStep(), 500);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error al guardar el método de pago");
    }
  };

  const handleSkip = () => {
    nextStep();
  };

  if (paymentSaved) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Método de pago</h2>
        </div>

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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Método de pago</h2>
        <p className="text-muted-foreground">
          Agrega tu tarjeta para comenzar después del período de prueba
        </p>
      </div>

      {!clientSecret && !isStripe ? (
        // Country selection + MP form
        <>
          <Card>
            <CardHeader>
              <CardTitle>País de facturación</CardTitle>
              <CardDescription>Selecciona tu país para procesamiento de pago</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Select value={billingCountry} onValueChange={setBillingCountry}>
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

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-900">
                    {billingCountry === "AR"
                      ? "✓ Se procesará con Mercado Pago"
                      : "✓ Se procesará con Stripe"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos de la tarjeta</CardTitle>
              <CardDescription>Ingresa los datos de tu tarjeta de forma segura</CardDescription>
            </CardHeader>
            <CardContent>
              <MercadoPagoForm onSuccess={handlePaymentSuccess} onSkip={handleSkip} isLoading={loading} />
            </CardContent>
          </Card>

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={prevStep} disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
          </div>
        </>
      ) : isStripe && !clientSecret ? (
        // Country selection for Stripe
        <>
          <Card>
            <CardHeader>
              <CardTitle>País de facturación</CardTitle>
              <CardDescription>Selecciona tu país para procesamiento de pago</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Select value={billingCountry} onValueChange={setBillingCountry} disabled={loading}>
                    <SelectTrigger id="country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.filter((c) => c.code !== "AR").map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-900">✓ Se procesará con Stripe</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Datos de la tarjeta
              </CardTitle>
              <CardDescription>Ingresa tu tarjeta de crédito o débito</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleInitializePayment} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando formulario...
                  </>
                ) : (
                  "Continuar con Stripe"
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={prevStep} disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
            <Button variant="outline" onClick={handleSkip} disabled={loading}>
              Saltar por ahora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        // Stripe form (shown after country selection)
        <>
          <Card>
            <CardHeader>
              <CardTitle>Datos de la tarjeta</CardTitle>
              <CardDescription>Tus datos están protegidos y encriptados de forma segura</CardDescription>
            </CardHeader>
            <CardContent>
              {stripePromise && clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripePaymentForm
                    clientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                    onSkip={handleSkip}
                    isLoading={loading}
                  />
                </Elements>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => setClientSecret(null)} disabled={loading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Atrás
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
