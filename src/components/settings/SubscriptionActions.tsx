// src/components/settings/SubscriptionActions.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export function SubscriptionActions({ companyId, subscriptionStatus }: { companyId?: string; subscriptionStatus?: string }) {
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { company_id: companyId, reason: cancelReason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Suscripción cancelada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["subscription", companyId] });
      setShowCancelDialog(false);
      setCancelReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al cancelar suscripción");
    },
  });

  const isLoading = cancelMutation.isPending;
  const canCancel = subscriptionStatus && ["active", "trialing", "incomplete", "past_due"].includes(subscriptionStatus);

  return (
    <>
      <div className="flex gap-2">
        {canCancel && (
          <Button
            variant="destructive"
            onClick={() => setShowCancelDialog(true)}
            disabled={isLoading}
          >
            Cancelar suscripción
          </Button>
        )}
      </div>

      {/* Cancellation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancelar suscripción
            </DialogTitle>
            <DialogDescription>Esta acción es permanente. Tu acceso a funcionalidades premium será deshabilitado.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-destructive/10 p-3 rounded-lg text-sm">
              <p className="font-semibold text-destructive">⚠️ Advertencia</p>
              <p className="mt-1">Al cancelar tu suscripción:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Perderás acceso a funcionalidades premium</li>
                <li>Los datos se mantendrán disponibles</li>
                <li>Podrás reactivar tu suscripción en cualquier momento</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancel-reason">¿Por qué cancelas? (opcional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Cuéntanos por qué decides cancelar..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              No, mantener suscripción
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={isLoading}
            >
              {isLoading ? "Cancelando..." : "Sí, cancelar suscripción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
