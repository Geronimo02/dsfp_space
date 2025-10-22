import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Building2, DollarSign, Receipt, MessageSquare, Database, AlertTriangle, Package, Users } from "lucide-react";
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
  email: z.string().trim().toLowerCase().max(255, "El email debe tener máximo 255 caracteres")
    .refine((val) => val === "" || z.string().email().safeParse(val).success, "Email inválido")
    .optional(),
  phone: z.string().max(20, "El teléfono debe tener máximo 20 caracteres").optional(),
  tax_id: z.string().max(50, "El Tax ID debe tener máximo 50 caracteres").optional(),
  address: z.string().max(500, "La dirección debe tener máximo 500 caracteres").optional(),
  default_tax_rate: z.number({ invalid_type_error: "El impuesto debe ser un número" })
    .min(0, "El impuesto no puede ser negativo")
    .max(100, "El impuesto no puede ser mayor a 100%"),
  card_surcharge_rate: z.number({ invalid_type_error: "El recargo debe ser un número" })
    .min(0, "El recargo no puede ser negativo")
    .max(100, "El recargo no puede ser mayor a 100%"),
  currency: z.string().length(3, "El código de moneda debe tener 3 caracteres (ISO 4217)"),
  receipt_footer: z.string().max(500, "El pie de ticket debe tener máximo 500 caracteres").optional(),
  receipt_format: z.string().optional(),
  receipt_printer_name: z.string().max(100, "El nombre de impresora debe tener máximo 100 caracteres").optional(),
  whatsapp_number: z.string().max(20, "El número debe tener máximo 20 caracteres").optional(),
  whatsapp_enabled: z.boolean(),
  low_stock_alert: z.boolean(),
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
    card_surcharge_rate: "",
    currency: "",
    receipt_footer: "",
    receipt_format: "thermal",
    receipt_printer_name: "",
    whatsapp_number: "",
    whatsapp_enabled: false,
    low_stock_alert: true,
    loyalty_enabled: false,
    loyalty_points_per_currency: "1",
    loyalty_currency_per_point: "0.01",
    loyalty_bronze_threshold: "0",
    loyalty_silver_threshold: "10000",
    loyalty_gold_threshold: "50000",
    loyalty_bronze_discount: "0",
    loyalty_silver_discount: "5",
    loyalty_gold_discount: "10",
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
        card_surcharge_rate: data.card_surcharge_rate?.toString() || "",
        currency: data.currency || "USD",
        receipt_footer: data.receipt_footer || "",
        receipt_format: data.receipt_format || "thermal",
        receipt_printer_name: data.receipt_printer_name || "",
        whatsapp_number: data.whatsapp_number || "",
        whatsapp_enabled: data.whatsapp_enabled || false,
        low_stock_alert: data.low_stock_alert !== false,
        loyalty_enabled: data.loyalty_enabled || false,
        loyalty_points_per_currency: data.loyalty_points_per_currency?.toString() || "1",
        loyalty_currency_per_point: data.loyalty_currency_per_point?.toString() || "0.01",
        loyalty_bronze_threshold: data.loyalty_bronze_threshold?.toString() || "0",
        loyalty_silver_threshold: data.loyalty_silver_threshold?.toString() || "10000",
        loyalty_gold_threshold: data.loyalty_gold_threshold?.toString() || "50000",
        loyalty_bronze_discount: data.loyalty_bronze_discount?.toString() || "0",
        loyalty_silver_discount: data.loyalty_silver_discount?.toString() || "5",
        loyalty_gold_discount: data.loyalty_gold_discount?.toString() || "10",
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
          card_surcharge_rate: parseFloat(data.card_surcharge_rate) || 0,
          currency: data.currency,
          receipt_footer: data.receipt_footer || null,
          receipt_format: data.receipt_format || "thermal",
          receipt_printer_name: data.receipt_printer_name || null,
          whatsapp_number: data.whatsapp_number || null,
          whatsapp_enabled: data.whatsapp_enabled,
          low_stock_alert: data.low_stock_alert,
          loyalty_enabled: data.loyalty_enabled,
          loyalty_points_per_currency: parseFloat(data.loyalty_points_per_currency) || 1,
          loyalty_currency_per_point: parseFloat(data.loyalty_currency_per_point) || 0.01,
          loyalty_bronze_threshold: parseFloat(data.loyalty_bronze_threshold) || 0,
          loyalty_silver_threshold: parseFloat(data.loyalty_silver_threshold) || 10000,
          loyalty_gold_threshold: parseFloat(data.loyalty_gold_threshold) || 50000,
          loyalty_bronze_discount: parseFloat(data.loyalty_bronze_discount) || 0,
          loyalty_silver_discount: parseFloat(data.loyalty_silver_discount) || 5,
          loyalty_gold_discount: parseFloat(data.loyalty_gold_discount) || 10,
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
        card_surcharge_rate: parseFloat(formData.card_surcharge_rate) || 0,
        currency: formData.currency,
        receipt_footer: formData.receipt_footer || undefined,
        receipt_format: formData.receipt_format || "thermal",
        receipt_printer_name: formData.receipt_printer_name || undefined,
        whatsapp_number: formData.whatsapp_number || undefined,
        whatsapp_enabled: formData.whatsapp_enabled,
        low_stock_alert: formData.low_stock_alert,
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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="company">Empresa</TabsTrigger>
            <TabsTrigger value="financial">Finanzas</TabsTrigger>
            <TabsTrigger value="loyalty">Fidelización</TabsTrigger>
            <TabsTrigger value="receipts">Tickets</TabsTrigger>
            <TabsTrigger value="inventory">Inventario</TabsTrigger>
            <TabsTrigger value="integrations">WhatsApp</TabsTrigger>
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
                      <p className="text-xs text-muted-foreground">
                        IVA o impuesto aplicado automáticamente a productos
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="card_surcharge_rate">Recargo Tarjeta de Crédito (%)</Label>
                      <Input
                        id="card_surcharge_rate"
                        type="number"
                        step="0.01"
                        value={formData.card_surcharge_rate}
                        onChange={(e) => setFormData({ ...formData, card_surcharge_rate: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Se aplicará automáticamente al pagar con tarjeta
                      </p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="currency">Moneda (Código ISO)</Label>
                      <Input
                        id="currency"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                        placeholder="USD, EUR, PEN, ARS, etc."
                        maxLength={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Código de 3 letras según ISO 4217 (ej: USD, EUR, ARS, PEN)
                      </p>
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

          {/* Programa de Fidelización */}
          <TabsContent value="loyalty" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Programa de Fidelización
                </CardTitle>
                <CardDescription>
                  Configura el sistema de puntos y recompensas para tus clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="loyalty_enabled">Activar Programa de Fidelización</Label>
                      <p className="text-sm text-muted-foreground">
                        Los clientes acumularán puntos por cada compra
                      </p>
                    </div>
                    <Switch
                      id="loyalty_enabled"
                      checked={formData.loyalty_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, loyalty_enabled: checked })}
                    />
                  </div>

                  {formData.loyalty_enabled && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="loyalty_points_per_currency">Puntos por Unidad de Moneda</Label>
                          <Input
                            id="loyalty_points_per_currency"
                            type="number"
                            step="0.01"
                            value={formData.loyalty_points_per_currency}
                            onChange={(e) => setFormData({ ...formData, loyalty_points_per_currency: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Ej: Si es 1, por cada $1 gastado se otorga 1 punto
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="loyalty_currency_per_point">Valor de Cada Punto</Label>
                          <Input
                            id="loyalty_currency_per_point"
                            type="number"
                            step="0.01"
                            value={formData.loyalty_currency_per_point}
                            onChange={(e) => setFormData({ ...formData, loyalty_currency_per_point: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Ej: Si es 0.01, cada punto vale $0.01 en descuentos
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <h3 className="font-semibold">Niveles de Fidelización</h3>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              🥉 Nivel Bronze
                            </Label>
                            <div className="space-y-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Monto mínimo"
                                value={formData.loyalty_bronze_threshold}
                                onChange={(e) => setFormData({ ...formData, loyalty_bronze_threshold: e.target.value })}
                              />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="% Descuento"
                                value={formData.loyalty_bronze_discount}
                                onChange={(e) => setFormData({ ...formData, loyalty_bronze_discount: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              🥈 Nivel Silver
                            </Label>
                            <div className="space-y-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Monto mínimo"
                                value={formData.loyalty_silver_threshold}
                                onChange={(e) => setFormData({ ...formData, loyalty_silver_threshold: e.target.value })}
                              />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="% Descuento"
                                value={formData.loyalty_silver_discount}
                                onChange={(e) => setFormData({ ...formData, loyalty_silver_discount: e.target.value })}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              🏆 Nivel Gold
                            </Label>
                            <div className="space-y-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Monto mínimo"
                                value={formData.loyalty_gold_threshold}
                                onChange={(e) => setFormData({ ...formData, loyalty_gold_threshold: e.target.value })}
                              />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="% Descuento"
                                value={formData.loyalty_gold_discount}
                                onChange={(e) => setFormData({ ...formData, loyalty_gold_discount: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="receipt_format">Formato de Ticket</Label>
                      <Select 
                        value={formData.receipt_format} 
                        onValueChange={(value) => setFormData({ ...formData, receipt_format: value })}
                      >
                        <SelectTrigger id="receipt_format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="thermal">Térmico (58mm/80mm)</SelectItem>
                          <SelectItem value="a4">A4 (Hoja completa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="receipt_printer_name">Nombre de Impresora</Label>
                      <Input
                        id="receipt_printer_name"
                        value={formData.receipt_printer_name}
                        onChange={(e) => setFormData({ ...formData, receipt_printer_name: e.target.value })}
                        placeholder="Ej: EPSON TM-T20"
                      />
                      <p className="text-xs text-muted-foreground">
                        Nombre exacto de la impresora configurada en el sistema
                      </p>
                    </div>
                  </div>

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

          {/* Inventario */}
          <TabsContent value="inventory" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Configuración de Inventario
                </CardTitle>
                <CardDescription>
                  Alertas y notificaciones de stock
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="low_stock_alert" className="text-base font-medium">
                        Alertas de Stock Bajo
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Recibe notificaciones cuando los productos alcancen su stock mínimo
                      </p>
                    </div>
                    <Switch
                      id="low_stock_alert"
                      checked={formData.low_stock_alert}
                      onCheckedChange={(checked) => setFormData({ ...formData, low_stock_alert: checked })}
                    />
                  </div>

                  <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                    <h4 className="font-semibold text-sm">Cómo funcionan las alertas</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Las alertas se activan cuando el stock actual &lt; stock mínimo</li>
                      <li>Puedes configurar el stock mínimo de cada producto individualmente</li>
                      <li>Los productos con stock bajo aparecerán destacados en los reportes</li>
                    </ul>
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

          {/* WhatsApp */}
          <TabsContent value="integrations" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Integración WhatsApp Business
                </CardTitle>
                <CardDescription>
                  Envía tickets y notificaciones por WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="whatsapp_enabled" className="text-base font-medium">
                        Activar WhatsApp
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Habilita el envío de mensajes por WhatsApp
                      </p>
                    </div>
                    <Switch
                      id="whatsapp_enabled"
                      checked={formData.whatsapp_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, whatsapp_enabled: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_number">Número de WhatsApp Business</Label>
                    <Input
                      id="whatsapp_number"
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                      placeholder="+1234567890"
                    />
                    <p className="text-xs text-muted-foreground">
                      Incluye el código de país (ej: +54 para Argentina, +51 para Perú)
                    </p>
                  </div>

                  <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                    <h4 className="font-semibold text-sm">Próximamente</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Envío automático de tickets de venta</li>
                      <li>Notificaciones de servicios técnicos</li>
                      <li>Recordatorios de pagos pendientes</li>
                      <li>Confirmaciones de compra</li>
                    </ul>
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

          {/* Sistema */}
          <TabsContent value="system" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Información y Backup
                </CardTitle>
                <CardDescription>
                  Estado del sistema y respaldos de base de datos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Estado de Backup
                    </h4>
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">
                        {settings?.last_backup_date 
                          ? `Último backup: ${new Date(settings.last_backup_date).toLocaleString('es')}`
                          : "Sin backup realizado"}
                      </p>
                      <p className="text-muted-foreground">
                        Estado: {settings?.backup_enabled ? "✓ Activado" : "✗ Desactivado"}
                      </p>
                    </div>
                    <Button variant="outline" disabled>
                      <Database className="mr-2 h-4 w-4" />
                      Crear Backup Manual (Próximamente)
                    </Button>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
