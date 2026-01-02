import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface MercadoPagoCardFieldsProps {
  onSuccess: (token: string, metadata: { 
    brand: string; 
    last4: string; 
    exp_month: number; 
    exp_year: number;
    payment_method_id?: string;
    issuer_id?: number;
  }) => void;
  isLoading: boolean;
  email: string;
  planId: string;
  planAmount: number;
}

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

export function MercadoPagoCardFields({ onSuccess, isLoading, email, planId, planAmount }: MercadoPagoCardFieldsProps) {
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
                  amount: planAmount,
                  payer: { email: undefined },
                },
                customization: {
                  paymentMethods: { maxInstallments: 1 },
                  texts: {
                    formSubmit: "Guardar y continuar", // Cambia texto del botón de MP
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
                      console.log("[MP] Full formData structure:", JSON.stringify(formData, null, 2));
                      
                      // MP Bricks returns the token directly in formData.token
                      const token = formData.token;
                      if (!token) {
                        throw new Error("No token from MP Bricks");
                      }

                      console.log("[MP] Card tokenized successfully, will charge in Step 5...");

                      // Extract metadata from MP Bricks response
                      // MP Bricks exposes last 4 digits in formData.lastFourDigits or formData.bin
                      const brand = formData.payment_method_id || "unknown";
                      const last4 = formData.lastFourDigits || formData.bin?.slice(-4) || "****";
                      const exp_month = 0; // MP doesn't expose expiration in token response
                      const exp_year = 0;
                      const payment_method_id = formData.payment_method_id;
                      const issuer_id = formData.issuer_id ? parseInt(formData.issuer_id, 10) : undefined;

                      console.log("[MP] Raw formData values:", {
                        payment_method_id: formData.payment_method_id,
                        issuer_id: formData.issuer_id,
                      });

                      const metadata = { 
                        brand, 
                        last4, 
                        exp_month, 
                        exp_year,
                        payment_method_id,
                        issuer_id,
                      };
                      console.log("[MP] Extracted metadata:", JSON.stringify(metadata, null, 2));

                      toast.success("Tarjeta guardada. Confirma tu cuenta en el siguiente paso.");
                      onSuccess(token, metadata); // Pass token, will charge in finalize-signup
                    } catch (error: any) {
                      console.error("[MP] Submit error:", error);
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
  }, [onSuccess, planAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // No-op: usamos el botón del Brick
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
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        Usando Mercado Pago para procesar tu tarjeta de forma segura
      </div>

      <div id="cardPayment" className="mb-4">
        {!mpLoaded && (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Cargando formulario de Mercado Pago...
          </div>
        )}
      </div>
    </div>
  );
}
