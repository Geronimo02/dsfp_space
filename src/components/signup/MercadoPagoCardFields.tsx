import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MercadoPagoCardFieldsProps {
  onSuccess: (token: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

export function MercadoPagoCardFields({ onSuccess, onSkip, isLoading }: MercadoPagoCardFieldsProps) {
  const [saving, setSaving] = useState(false);
  const [mpLoaded, setMpLoaded] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bricksRef = useRef<any>(null);
  const cardPaymentRef = useRef<any>(null);

  const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;

  useEffect(() => {
    if (!publicKey) {
      setMpError("Mercado Pago no está configurado");
      return;
    }

    const initMercadoPago = async () => {
      try {
        // Load MP SDK
        const script = document.createElement("script");
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.async = true;
        script.onload = async () => {
          try {
            if (window.MercadoPago) {
              // Initialize MP with public key (new API - use constructor)
              const mp = new window.MercadoPago(publicKey, {
                locale: "es-AR",
              });

              // Initialize Bricks (lowercase API in v2)
              const bricksBuilder = mp.bricks();
              bricksRef.current = bricksBuilder;

              const bricksInstance = await bricksBuilder.create("cardPayment", {
              initialization: {
                amount: 0, // We don't know the amount yet, it will be 0 for token-only
                payer: {
                  email: undefined, // Set dynamically if needed
                },
              },
              callbacks: {
                onReady: () => {
                  console.log("[MP] Card Payment Brick ready");
                  setMpLoaded(true);
                },
                onError: (error: any) => {
                  console.error("[MP] Brick error:", error);
                  setMpError(error?.message || "Error en Mercado Pago");
                },
                onSubmit: async (formData: any) => {
                  setSaving(true);
                  try {
                    // Create token with MP
                    const response = await fetch(
                      "https://api.mercadopago.com/v1/card_tokens",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${publicKey}`,
                        },
                        body: JSON.stringify({
                          cardNumber: formData.cardNumber?.replaceAll(" ", ""),
                          cardholderName: formData.cardholderName,
                          cardExpirationMonth: formData.cardExpirationMonth,
                          cardExpirationYear: formData.cardExpirationYear,
                          securityCode: formData.securityCode,
                        }),
                      }
                    );

                    if (!response.ok) {
                      throw new Error("Error al tokenizar tarjeta");
                    }

                    const data = await response.json();
                    console.log("[MP] Token created:", data.id);

                    onSuccess(data.id);
                  } catch (error: any) {
                    console.error("[MP] Token error:", error);
                    toast.error(error?.message || "Error al procesar la tarjeta");
                    setSaving(false);
                  }
                },
              },
              });

              cardPaymentRef.current = bricksInstance;
            }
          } catch (error: any) {
            console.error("[MP] Script onload error:", error);
            setMpError(error?.message || "Error al cargar Mercado Pago");
          }
        };
        script.onerror = () => {
          setMpError("No se pudo cargar Mercado Pago");
        };
        document.body.appendChild(script);
      } catch (error: any) {
        console.error("[MP] Init error:", error);
        setMpError(error?.message || "Error inicializando Mercado Pago");
      }
    };

    initMercadoPago();

    return () => {
      if (cardPaymentRef.current) {
        cardPaymentRef.current.unmount();
      }
    };
  }, [publicKey, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardPaymentRef.current) return;

    try {
      setSaving(true);
      // Trigger brick's submit
      await cardPaymentRef.current.submit();
    } catch (error: any) {
      console.error("[MP] Submit error:", error);
      toast.error(error?.message || "Error al guardar la tarjeta");
      setSaving(false);
    }
  };

  if (mpError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{mpError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        Usando Mercado Pago Bricks para procesar tu tarjeta de forma segura
      </div>

      {/* MP Bricks will render here */}
      <div ref={containerRef} id="cardPayment" className="mb-4">
        {!mpLoaded && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Cargando formulario de Mercado Pago...
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-between">
        <Button type="button" variant="ghost" onClick={onSkip} disabled={saving || isLoading || !mpLoaded}>
          Saltar por ahora
        </Button>
        <Button type="submit" disabled={saving || isLoading || !mpLoaded}>
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
