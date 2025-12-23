import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { Loader2, Building2, Mail, User, CreditCard, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const MODULE_PRICE = 10;

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

  const { data: plan } = useQuery({
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

  const handleConfirm = async () => {
    try {
      setIsCreating(true);
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
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground">Plan:</span>
                <div className="text-right">
                  <p className="font-medium">{plan?.name}</p>
                  <p className="text-xs text-muted-foreground">{plan?.description}</p>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio base:</span>
                <span className="font-medium">${baseCost} USD/mes</span>
              </div>
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

        {/* Right column - Summary & Provider */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen del pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan {plan?.name}:</span>
                  <span>${baseCost} USD</span>
                </div>
                {formData.modules.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Módulos ({formData.modules.length}):
                    </span>
                    <span>${totalModulesCost} USD</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total mensual:</span>
                  <span className="text-primary">${totalCost} USD</span>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-base mb-3 block">Método de pago</Label>
                <RadioGroup
                  value={formData.provider}
                  onValueChange={(value) =>
                    updateFormData({ provider: value as "stripe" | "mercadopago" })
                  }
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="mercadopago" id="mercadopago" />
                    <Label htmlFor="mercadopago" className="flex-1 cursor-pointer">
                      <p className="font-medium">Mercado Pago</p>
                      <p className="text-xs text-muted-foreground">Pago en pesos argentinos</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="stripe" id="stripe" />
                    <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                      <p className="font-medium">Stripe</p>
                      <p className="text-xs text-muted-foreground">Tarjeta de crédito internacional</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm text-center">
                Al confirmar, serás redirigido al procesador de pagos para completar la suscripción.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button onClick={prevStep} variant="outline" size="lg" disabled={isCreating}>
          Atrás
        </Button>
        <Button onClick={handleConfirm} size="lg" disabled={isCreating}>
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : (
            "Confirmar y proceder al pago"
          )}
        </Button>
      </div>
    </div>
  );
}
