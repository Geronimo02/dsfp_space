import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface MercadoPagoCardFieldsProps {
  onSuccess: (token: string) => void;
  isLoading: boolean;
}

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

export function MercadoPagoCardFields({ onSuccess, isLoading }: MercadoPagoCardFieldsProps) {
  const [saving, setSaving] = useState(false);
  const [mpLoaded, setMpLoaded] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const cardPaymentRef = useRef<any>(null);
  const publicKeyRef = useRef(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY);

  useEffect(() => {
    if (!publicKeyRef.current) {
      setMpError("Mercado Pago no está configurado");
      return;
    }

    const initMercadoPago = async () => {
      try {
        const script = document.createElement("script");
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.async = true;
        script.onload = async () => {
          try {
            if (window.MercadoPago) {
              const mp = new window.MercadoPago(publicKeyRef.current, { locale: "es-AR" });
              const bricksBuilder = mp.bricks();

              const bricksInstance = await bricksBuilder.create("cardPayment", "cardPayment", {
                initialization: {
                  amount: 1000, // use higher amount to enable all payment methods
                  payer: {
                    email: undefined,
                  },
                },
                customization: {
                  paymentMethods: {
                    maxInstallments: 1,
                  },
                },
                callbacks: {
                  onReady: () => {
                    setMpLoaded(true);
                  },
                  onError: (error: any) => {
                    console.error("[MP] Brick error:", error);
                    setMpError(error?.message || "Error en Mercado Pago");
                  },
                  onSubmit: async (formData: any) => {
                    setSaving(true);
                    try {
                      console.log("[MP] formData received:", formData);
                      
                      // MP Bricks returns token in formData
                      if (formData.token) {
                        toast.success("Tarjeta guardada exitosamente");
                        onSuccess(formData.token);
                      } else {
                        throw new Error("No se recibió token de Mercado Pago");
                      }
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
        try {
          cardPaymentRef.current.unmount();
        } catch (e) {
          console.log("[MP] Unmount error (ok):", e);
        }
      }
    };
  }, [onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardPaymentRef.current) return;

    try {
      setSaving(true);
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

      <div id="cardPayment" className="mb-4">
        {!mpLoaded && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Cargando formulario de Mercado Pago...
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end">
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
