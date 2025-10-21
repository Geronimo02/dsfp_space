import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, DollarSign, Receipt, MessageSquare, Database, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const settingsSchema = z.object({
  company_name: z.string().trim().min(1, "El nombre de la empresa es requerido").max(200, "El nombre debe tener máximo 200 caracteres"),
  email: z.string().trim().max(255, "El email debe tener máximo 255 caracteres")
    .refine((val) => val === "" || z.string().email().safeParse(val).success, "Email inválido")
    .optional(),
  phone: z.string().max(20, "El teléfono debe tener máximo 20 caracteres").optional(),
  tax_id: z.string().max(50, "El Tax ID debe tener máximo 50 caracteres").optional(),
  address: z.string().max(500, "La dirección debe tener máximo 500 caracteres").optional(),
  default_tax_rate: z.number({ invalid_type_error: "El impuesto debe ser un número" })
    .min(0, "El impuesto no puede ser negativo")
    .max(100, "El impuesto no puede ser mayor a 100%"),
  currency: z.string().length(3, "El código de moneda debe tener 3 caracteres (ISO 4217)"),
  receipt_footer: z.string().max(500, "El pie de ticket debe tener máximo 500 caracteres").optional(),
});

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
    
    try {
      // Parse and validate input data
      const validatedData = settingsSchema.parse({
        company_name: formData.company_name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        tax_id: formData.tax_id || undefined,
        address: formData.address || undefined,
        default_tax_rate: parseFloat(formData.default_tax_rate) || 0,
        currency: formData.currency,
        receipt_footer: formData.receipt_footer || undefined,
      });

      updateSettingsMutation.mutate(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error("Error al validar la configuración");
      }
    }
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
          <h1 className="text-3xl font-bold text-foreground">Configuración del Sistema</h1>
          <p className="text-muted-foreground">Administra todos los ajustes globales del sistema</p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="company">Empresa</TabsTrigger>
            <TabsTrigger value="financial">Finanzas</TabsTrigger>
            <TabsTrigger value="receipts">Tickets</TabsTrigger>
            <TabsTrigger value="integrations">Integraciones</TabsTrigger>
            <TabsTrigger value="system">Sistema</TabsTrigger>
          </TabsList>

          {/* Empresa */}
          <TabsContent value="company" className="space-y-6">
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

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={updateSettingsMutation.isPending}>
                      {updateSettingsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finanzas */}
          <TabsContent value="financial" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Configuración Financiera
                </CardTitle>
                <CardDescription>
                  Ajustes de impuestos y moneda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                      <Label htmlFor="currency">Moneda (Código ISO)</Label>
                      <Input
                        id="currency"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        placeholder="USD, EUR, PEN, etc."
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
          </TabsContent>

          {/* Tickets */}
          <TabsContent value="receipts" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Configuración de Tickets
                </CardTitle>
                <CardDescription>
                  Personaliza la apariencia de tus tickets de venta
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="receipt_footer">Mensaje en el Ticket</Label>
                    <Textarea
                      id="receipt_footer"
                      value={formData.receipt_footer}
                      onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                      placeholder="Ej: ¡Gracias por su compra! Vuelva pronto."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Este mensaje aparecerá al final de cada ticket impreso
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={updateSettingsMutation.isPending}>
                      {updateSettingsMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integraciones */}
          <TabsContent value="integrations" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Integraciones Externas
                </CardTitle>
                <CardDescription>
                  Conecta servicios externos como WhatsApp, Email, etc.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold">WhatsApp Business</h4>
                    <p className="text-sm text-muted-foreground">
                      Próximamente: Envía notificaciones y tickets por WhatsApp
                    </p>
                    <Button variant="outline" disabled>
                      Configurar WhatsApp
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold">Correo Electrónico</h4>
                    <p className="text-sm text-muted-foreground">
                      Próximamente: Envía facturas y reportes por email
                    </p>
                    <Button variant="outline" disabled>
                      Configurar Email
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold">Backup Automático</h4>
                    <p className="text-sm text-muted-foreground">
                      Próximamente: Respalda tu base de datos automáticamente
                    </p>
                    <Button variant="outline" disabled>
                      Configurar Backup
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sistema */}
          <TabsContent value="system" className="space-y-6">
            <Card className="shadow-soft border-destructive/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Zona de Peligro
                </CardTitle>
                <CardDescription>
                  Acciones críticas que pueden afectar permanentemente tu sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border border-destructive rounded-lg p-4 space-y-2 bg-destructive/5">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Reset de Base de Datos
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Elimina TODOS los datos del sistema (ventas, productos, clientes, etc.)
                    </p>
                    <p className="text-sm font-semibold text-destructive">
                      ⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE
                    </p>
                    <Button variant="destructive" disabled>
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Reset Completo (Deshabilitado)
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Por seguridad, esta función requiere acceso directo a la base de datos en Supabase
                    </p>
                  </div>

                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold">Información del Sistema</h4>
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">Versión: 1.0.0</p>
                      <p className="text-muted-foreground">Base de datos: Supabase (PostgreSQL)</p>
                      <p className="text-muted-foreground">Framework: React + Vite</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
