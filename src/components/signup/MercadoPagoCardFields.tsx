import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MercadoPagoCardFieldsProps {
  onSuccess: (token: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}

export function MercadoPagoCardFields({ onSuccess, onSkip, isLoading }: MercadoPagoCardFieldsProps) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cardData, setCardData] = useState({
    number: "",
    expiry: "",
    cvc: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || isLoading) return;

    setSaving(true);
    setErrors({});

    try {
      // Validate all fields are filled
      if (!cardData.number.replace(/\s/g, "")) {
        throw new Error("Ingresa el número de tarjeta");
      }
      if (!cardData.expiry) {
        throw new Error("Ingresa la fecha de vencimiento");
      }
      if (!cardData.cvc) {
        throw new Error("Ingresa el CVC");
      }

      // Format card number for validation
      const cardNumber = cardData.number.replace(/\s/g, "");
      if (cardNumber.length < 13 || cardNumber.length > 19) {
        throw new Error("Número de tarjeta inválido");
      }

      // Parse expiry
      const [month, year] = cardData.expiry.split("/");
      if (!month || !year || month.length !== 2 || year.length !== 2) {
        throw new Error("Formato de vencimiento inválido (MM/YY)");
      }

      if (cardData.cvc.length < 3 || cardData.cvc.length > 4) {
        throw new Error("CVC debe tener 3 o 4 dígitos");
      }

      // In production, you would call MP Bricks or Fields API here to tokenize
      // For now, generate a mock token
      const mockToken = `mp_tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      onSuccess(mockToken);
    } catch (e: any) {
      console.error(e);
      const errorMsg = e?.message ?? "Error al procesar la tarjeta";
      setErrors({ general: errorMsg });
      toast.error(errorMsg);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="mp-card-number">Número de tarjeta</Label>
        <input
          id="mp-card-number"
          type="text"
          placeholder="1234 5678 9012 3456"
          maxLength={19}
          value={cardData.number}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").replace(/(\d{4})/g, "$1 ").trim();
            setCardData({ ...cardData, number: val });
          }}
          className="w-full px-3 py-2 border rounded-md"
          disabled={saving || isLoading}
        />
        {errors.number && <p className="text-sm text-red-500">{errors.number}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mp-expiry">Vencimiento (MM/YY)</Label>
          <input
            id="mp-expiry"
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
          {errors.expiry && <p className="text-sm text-red-500">{errors.expiry}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mp-cvc">CVC</Label>
          <input
            id="mp-cvc"
            type="text"
            placeholder="123"
            maxLength={4}
            value={cardData.cvc}
            onChange={(e) => setCardData({ ...cardData, cvc: e.target.value.replace(/\D/g, "") })}
            className="w-full px-3 py-2 border rounded-md"
            disabled={saving || isLoading}
          />
          {errors.cvc && <p className="text-sm text-red-500">{errors.cvc}</p>}
        </div>
      </div>

      {errors.general && <p className="text-sm text-red-500">{errors.general}</p>}

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
