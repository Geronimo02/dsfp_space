import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Building2, Users, Bell, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Settings() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    company_name: "",
    tax_id: "",
    address: "",
    phone: "",
    email: "",
    default_tax_rate: "",
    currency: "",
    receipt_footer: "",
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .single();
      
      if (error) throw error;
      
      // Update form with loaded data
      setFormData({
        company_name: data.company_name || "",
        tax_id: data.tax_id || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        default_tax_rate: data.default_tax_rate?.toString() || "",
        currency: data.currency || "USD",
        receipt_footer: data.receipt_footer || "",
      });
      
      return data;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!settings?.id) throw new Error("No settings found");
      
      const { error } = await supabase
        .from("company_settings")
        .update({
          company_name: data.company_name,
          tax_id: data.tax_id || null,
          address: data.address || null,
          phone: data.phone || null,
          email: data.email || null,
          default_tax_rate: parseFloat(data.default_tax_rate) || 0,
          currency: data.currency,
          receipt_footer: data.receipt_footer || null,
        })
        .eq("id", settings.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración actualizada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar configuración");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          Cargando configuración...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configuración</h1>
          <p className="text-muted-foreground">Administra la configuración del sistema</p>
        </div>

        <div className="grid gap-6">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Datos de la Empresa
              </CardTitle>
              <CardDescription>
                Información que aparecerá en tickets y facturas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nombre de la Empresa *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">RUC / Tax ID</Label>
                    <Input
                      id="tax_id"
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Dirección</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Configuración Financiera
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="default_tax_rate">Impuesto por Defecto (%)</Label>
                      <Input
                        id="default_tax_rate"
                        type="number"
                        step="0.01"
                        value={formData.default_tax_rate}
                        onChange={(e) => setFormData({ ...formData, default_tax_rate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency">Moneda</Label>
                      <Input
                        id="currency"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h3 className="text-lg font-semibold mb-4">Pie de Ticket</h3>
                  <div className="space-y-2">
                    <Label htmlFor="receipt_footer">Mensaje en el Ticket</Label>
                    <Textarea
                      id="receipt_footer"
                      value={formData.receipt_footer}
                      onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                      placeholder="Ej: ¡Gracias por su compra! Vuelva pronto."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateSettingsMutation.isPending}>
                    {updateSettingsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-soft hover:shadow-medium transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Usuarios y Roles
                </CardTitle>
                <CardDescription>
                  Control de acceso y permisos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Próximamente: Gestión de usuarios y roles del sistema (Admin, Manager, Empleado)
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-medium transition-all">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Notificaciones
                </CardTitle>
                <CardDescription>
                  Alertas y notificaciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Próximamente: Configuración de alertas de stock bajo, vencimientos y otras notificaciones
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
