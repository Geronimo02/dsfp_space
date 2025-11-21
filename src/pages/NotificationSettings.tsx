import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, MessageCircle, Save } from "lucide-react";
import { toast } from "sonner";

export default function NotificationSettings() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences", currentCompany?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .eq("company_id", currentCompany?.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const [formData, setFormData] = useState({
    email_enabled: preferences?.email_enabled ?? true,
    whatsapp_enabled: preferences?.whatsapp_enabled ?? false,
    whatsapp_number: preferences?.whatsapp_number ?? "",
    low_stock: preferences?.low_stock ?? true,
    expiring_products: preferences?.expiring_products ?? true,
    inactive_customers: preferences?.inactive_customers ?? true,
    overdue_invoices: preferences?.overdue_invoices ?? true,
    expiring_checks: preferences?.expiring_checks ?? true,
    daily_summary: preferences?.daily_summary ?? false,
    weekly_summary: preferences?.weekly_summary ?? false,
  });

  const savePreferences = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          company_id: currentCompany?.id,
          ...formData,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Preferencias actualizadas correctamente");
    },
    onError: (error) => {
      console.error("Error saving preferences:", error);
      toast.error("Error al guardar preferencias");
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <p>Cargando preferencias...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuración de Notificaciones</h1>
          <p className="text-muted-foreground">
            Personaliza cómo y cuándo recibir alertas del sistema
          </p>
        </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Canales de Notificación</h2>
          </div>
          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>Notificaciones por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir alertas en tu correo electrónico
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.email_enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, email_enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label>Notificaciones por WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Recibir alertas en WhatsApp (próximamente)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.whatsapp_enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, whatsapp_enabled: checked })
                  }
                  disabled
                />
              </div>
              {formData.whatsapp_enabled && (
                <div className="ml-8">
                  <Label>Número de WhatsApp</Label>
                  <Input
                    type="tel"
                    placeholder="+54 9 11 1234-5678"
                    value={formData.whatsapp_number}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsapp_number: e.target.value })
                    }
                    disabled
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Tipos de Alertas</h2>
          <p className="text-sm text-muted-foreground">
            Selecciona qué alertas quieres recibir
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Stock Bajo</Label>
                <p className="text-sm text-muted-foreground">
                  Productos por debajo del stock mínimo
                </p>
              </div>
              <Switch
                checked={formData.low_stock}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, low_stock: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Productos por Vencer</Label>
                <p className="text-sm text-muted-foreground">
                  Productos próximos a su fecha de vencimiento
                </p>
              </div>
              <Switch
                checked={formData.expiring_products}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, expiring_products: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Clientes Inactivos</Label>
                <p className="text-sm text-muted-foreground">
                  Clientes que no compran hace más de 60 días
                </p>
              </div>
              <Switch
                checked={formData.inactive_customers}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, inactive_customers: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Facturas Vencidas</Label>
                <p className="text-sm text-muted-foreground">
                  Cuentas corrientes con pagos atrasados
                </p>
              </div>
              <Switch
                checked={formData.overdue_invoices}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, overdue_invoices: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Cheques por Vencer</Label>
                <p className="text-sm text-muted-foreground">
                  Cheques que vencen en los próximos 7 días
                </p>
              </div>
              <Switch
                checked={formData.expiring_checks}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, expiring_checks: checked })
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Resúmenes</h2>
          <p className="text-sm text-muted-foreground">
            Recibe resúmenes periódicos de actividad
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Resumen Diario</Label>
                <p className="text-sm text-muted-foreground">
                  Resumen de todas las alertas del día
                </p>
              </div>
              <Switch
                checked={formData.daily_summary}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, daily_summary: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Resumen Semanal</Label>
                <p className="text-sm text-muted-foreground">
                  Resumen de actividad de la semana
                </p>
              </div>
              <Switch
                checked={formData.weekly_summary}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, weekly_summary: checked })
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => savePreferences.mutate()} disabled={savePreferences.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Preferencias
          </Button>
        </div>
      </Card>
    </div>
    </Layout>
  );
}
