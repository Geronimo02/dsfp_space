import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const FREE_PLAN_ID = "460d1274-59bc-4c99-a815-c3c1d52d0803";

interface Step2PlanProps {
  formData: SignupFormData;
  updateFormData: (data: Partial<SignupFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export function Step2Plan({ formData, updateFormData, nextStep, prevStep }: Step2PlanProps) {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-plans", {
        body: {},
      });
      if (error) throw error;
      return (data?.plans ?? []) as Array<{
        id: string;
        name: string;
        description: string | null;
        price: number;
        billing_period: string | null;
      }>;
    },
  });

  const handlePlanSelect = (planId: string) => {
    updateFormData({ plan_id: planId });
  };

  const handleNext = () => {
    if (!formData.plan_id) return;
    nextStep();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Elige tu plan</h2>
        <p className="text-muted-foreground">Selecciona el plan que mejor se adapte a tus necesidades</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans?.map((plan) => {
          const isSelected = formData.plan_id === plan.id;
          const isFree = plan.id === FREE_PLAN_ID;

          return (
            <Card
              key={plan.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-lg",
                isSelected && "ring-2 ring-primary shadow-lg"
              )}
              onClick={() => handlePlanSelect(plan.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <CardDescription className="min-h-[3rem]">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold">
                      ${plan.price}
                      {plan.billing_period && (
                        <span className="text-sm text-muted-foreground font-normal">
                          /{plan.billing_period}
                        </span>
                      )}
                    </p>
                  </div>

                  {isFree && (
                    <Badge variant="secondary" className="w-full justify-center">
                      7 días gratis • Requiere tarjeta
                    </Badge>
                  )}

                  {isFree && (
                    <p className="text-xs text-muted-foreground">
                      No se cobrará hoy. Al finalizar los 7 días de prueba, se debitará automáticamente el plan Básico.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button onClick={prevStep} variant="outline" size="lg">
          Atrás
        </Button>
        <Button onClick={handleNext} disabled={!formData.plan_id} size="lg">
          Continuar
        </Button>
      </div>
    </div>
  );
}
