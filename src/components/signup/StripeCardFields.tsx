import { useState } from "react";
import { CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const elementOptions = {
  style: {
    base: {
      fontSize: "16px",
      color: "#424770",
      "::placeholder": {
        color: "#aab7c4",
      },
    },
    invalid: {
      color: "#9e2146",
    },
  },
};

interface StripeCardFieldsProps {
  onSuccess: (paymentMethodId: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}

export function StripeCardFields({ onSuccess, onSkip, isLoading }: StripeCardFieldsProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || saving) return;

    setSaving(true);
    setErrors({});

    try {
      const cardNumber = elements.getElement(CardNumberElement);
      if (!cardNumber) throw new Error("Card element not found");

      // Create payment method
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: "card",
        card: cardNumber,
      });

      if (error) {
        throw new Error(error.message || "Error al procesar la tarjeta");
      }

      if (!paymentMethod?.id) {
        throw new Error("No se obtuvo payment method ID");
      }

      onSuccess(paymentMethod.id);
    } catch (e: any) {
      console.error(e);
      setErrors({ general: e?.message ?? "Error al guardar la tarjeta" });
      toast.error(e?.message ?? "Error al guardar la tarjeta");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="card-number">Número de tarjeta</Label>
        <div className="p-3 border rounded-md bg-white">
          <CardNumberElement id="card-number" options={elementOptions} />
        </div>
        {errors.number && <p className="text-sm text-red-500">{errors.number}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="card-expiry">Vencimiento (MM/YY)</Label>
          <div className="p-3 border rounded-md bg-white">
            <CardExpiryElement id="card-expiry" options={elementOptions} />
          </div>
          {errors.expiry && <p className="text-sm text-red-500">{errors.expiry}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="card-cvc">CVC</Label>
          <div className="p-3 border rounded-md bg-white">
            <CardCvcElement id="card-cvc" options={elementOptions} />
          </div>
          {errors.cvc && <p className="text-sm text-red-500">{errors.cvc}</p>}
        </div>
      </div>

      {errors.general && <p className="text-sm text-red-500">{errors.general}</p>}

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
