// src/components/settings/PlanChanger.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  description?: string;
  features?: string[];
}

export function PlanChanger({ companyId, currentPlanId }: { companyId?: string; currentPlanId?: string }) {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: availablePlans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price", { ascending: true });
      if (error) throw error;
      return data as Plan[];
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.functions.invoke("upgrade-subscription", {
        body: { company_id: companyId, new_plan_id: planId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Plan actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["subscription", companyId] });
      setShowConfirm(false);
      setSelectedPlan(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al cambiar plan");
    },
  });

  const isCurrentPlan = (planId: string) => planId === currentPlanId;
  const isLoading = upgradeMutation.isPending;

  return (
    <>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Cambiar Plan</CardTitle>
          <CardDescription>Selecciona un plan diferente para tu suscripción</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {availablePlans?.map((plan) => (
              <div
                key={plan.id}
                className={`p-4 border rounded-lg transition-all ${
                  isCurrentPlan(plan.id)
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"
                }`}
              >
                <div className="space-y-2">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-2xl font-bold">${plan.price}</p>
                  <p className="text-xs text-muted-foreground">USD/mes</p>
                  {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}

                  {isCurrentPlan(plan.id) ? (
                    <p className="text-xs text-primary font-medium">Plan actual</p>
                  ) : (
                    <Button
                      size="sm"
                      variant={plan.price > 0 ? "default" : "outline"}
                      onClick={() => {
                        setSelectedPlan(plan);
                        setShowConfirm(true);
                      }}
                      disabled={isLoading}
                      className="w-full mt-2"
                    >
                      Seleccionar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cambio de plan</DialogTitle>
            <DialogDescription>Esta acción actualizará tu suscripción inmediatamente</DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plan actual</p>
                  <p className="font-semibold">Tu plan actual</p>
                </div>
                <ArrowRight className="h-4 w-4" />
                <div>
                  <p className="text-sm text-muted-foreground">Nuevo plan</p>
                  <p className="font-semibold">{selectedPlan.name}</p>
                </div>
              </div>

              <div className="bg-muted p-3 rounded-lg text-sm">
                <p>
                  Si es un <strong>upgrade</strong>: se cobrará inmediatamente la diferencia prorrateada.
                </p>
                <p className="mt-1">
                  Si es un <strong>downgrade</strong>: el cambio se aplicará en el próximo período de facturación.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedPlan && upgradeMutation.mutate(selectedPlan.id)}
              disabled={isLoading}
            >
              {isLoading ? "Procesando..." : "Confirmar cambio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
