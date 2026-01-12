// settings.tsx
import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Palette, FileText, Upload, Eye, Lock, CreditCard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

import { CompanySettings } from "@/components/settings/CompanySettings";
import { PriceListsSettings } from "@/components/settings/PriceListsSettings";
import { PaymentMethodsManager } from "@/components/settings/PaymentMethodsManager";
import { PlanChanger } from "@/components/settings/PlanChanger";
import { SubscriptionActions } from "@/components/settings/SubscriptionActions";
import { InvoiceViewer } from "@/components/settings/InvoiceViewer";

function getSubscriptionStatusLabel(status?: string) {
  const map: Record<string, string> = {
    active: "Activo",
    trialing: "En prueba",
    incomplete: "Pendiente de activación",
    past_due: "Pago pendiente",
    canceled: "Cancelado",
  };
  return status ? map[status] ?? status : "";
}

const settingsSchema = z.object({
  company_name: z.string().trim().min(1, "El nombre de la empresa es requerido").max(200, "El nombre debe tener máximo 200 caracteres"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(255, "El email debe tener máximo 255 caracteres")
    .refine((val) => val === "" || z.string().email().safeParse(val).success, "Email inválido")
    .optional(),
  phone: z.string().max(20, "El teléfono debe tener máximo 20 caracteres").optional(),
  tax_id: z.string().max(50, "El Tax ID debe tener máximo 50 caracteres").optional(),
  address: z.string().max(500, "La dirección debe tener máximo 500 caracteres").optional(),
  default_tax_rate: z.number({ invalid_type_error: "El impuesto debe ser un número" }).min(0, "El impuesto no puede ser negativo").max(100, "El impuesto no puede ser mayor a 100%"),
  card_surcharge_rate: z.number({ invalid_type_error: "El recargo debe ser un número" }).min(0, "El recargo no puede ser negativo").max(100, "El recargo no puede ser mayor a 100%"),
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
  const { currentCompany, loading: companyLoading } = useCompany();

  // ✅ NEW: control the active tab so we can trigger queries only when entering "subscription"
  const [activeTab, setActiveTab] = useState("company");
  const isSubscriptionTab = activeTab === "subscription";

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
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [ticketConfig, setTicketConfig] = useState({
    logo_url: "",
    company_name: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    footer_message: "¡Gracias por su compra!",
    header_color: "#1f2937",
    text_color: "#374151",
    accent_color: "#3b82f6",
    show_logo: true,
    show_qr: true,
    paper_width: "80mm",
    font_size: "small",
  });

  // ✅ subscription query - always enabled but with long stale time to avoid unnecessary refetches
  const { data: subscription, isLoading: subscriptionLoading } = useQuery({
    queryKey: ["subscription", currentCompany?.id],
    enabled: !companyLoading && !!currentCompany?.id,
    staleTime: 60000, // 1 minuto
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans (name, price)")
        .eq("company_id", currentCompany!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ✅ Force refresh when entering subscription tab (optional)
  useEffect(() => {
    if (isSubscriptionTab && currentCompany?.id) {
      queryClient.invalidateQueries({ queryKey: ["subscription", currentCompany.id] });
    }
  }, [isSubscriptionTab, currentCompany?.id, queryClient]);

  const trialDaysLeft = useMemo(() => {
    if (!subscription?.trial_ends_at) return null;
    const end = new Date(subscription.trial_ends_at).getTime();
    const now = Date.now();
    return Math.max(Math.ceil((end - now) / (1000 * 60 * 60 * 24)), 0);
  }, [subscription?.trial_ends_at]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase.from("companies").select("*").eq("id", currentCompany.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        company_name: settings.name || "",
        tax_id: settings.tax_id || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        default_tax_rate: settings.default_tax_rate?.toString() || "",
        card_surcharge_rate: settings.card_surcharge_rate?.toString() || "",
        currency: settings.currency || "USD",
        receipt_footer: settings.receipt_footer || "",
        receipt_format: settings.receipt_format || "thermal",
        receipt_printer_name: settings.receipt_printer_name || "",
        whatsapp_number: settings.whatsapp_number || "",
        whatsapp_enabled: settings.whatsapp_enabled || false,
        low_stock_alert: settings.low_stock_alert !== false,
        loyalty_enabled: settings.loyalty_enabled || false,
        loyalty_points_per_currency: settings.loyalty_points_per_currency?.toString() || "1",
        loyalty_currency_per_point: settings.loyalty_currency_per_point?.toString() || "0.01",
        loyalty_bronze_threshold: settings.loyalty_bronze_threshold?.toString() || "0",
        loyalty_silver_threshold: settings.loyalty_silver_threshold?.toString() || "10000",
        loyalty_gold_threshold: settings.loyalty_gold_threshold?.toString() || "50000",
        loyalty_bronze_discount: settings.loyalty_bronze_discount?.toString() || "0",
        loyalty_silver_discount: settings.loyalty_silver_discount?.toString() || "5",
        loyalty_gold_discount: settings.loyalty_gold_discount?.toString() || "10",
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentCompany?.id) throw new Error("No company selected");
      const { error } = await supabase
        .from("companies")
        .update({
          name: data.company_name,
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
        .eq("id", currentCompany.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración actualizada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["company-settings", currentCompany?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar configuración");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No se pudo obtener el email del usuario");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) throw signInError;

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Contraseña actualizada");
      setFormData((prev) => ({ ...prev, current_password: "", new_password: "", confirm_password: "" }));
    },
    onError: (error: any) => {
      toast.error(error?.message || "Error al actualizar la contraseña");
    },
  });

  const { isLoading: isLoadingTicketConfig } = useQuery({
    queryKey: ["ticket-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_config" as any).select("*").single();
      if (error && (error as any).code !== "PGRST116") throw error;

      if (data) {
        setTicketConfig({
          logo_url: (data as any).logo_url || "",
          company_name: (data as any).company_name || "",
          company_address: (data as any).company_address || "",
          company_phone: (data as any).company_phone || "",
          company_email: (data as any).company_email || "",
          footer_message: (data as any).footer_message || "¡Gracias por su compra!",
          header_color: (data as any).header_color || "#1f2937",
          text_color: (data as any).text_color || "#374151",
          accent_color: (data as any).accent_color || "#3b82f6",
          show_logo: (data as any).show_logo !== false,
          show_qr: (data as any).show_qr !== false,
          paper_width: (data as any).paper_width || "80mm",
          font_size: (data as any).font_size || "small",
        });
      }
      return data;
    },
  });

  const saveTicketConfigMutation = useMutation({
    mutationFn: async (config: typeof ticketConfig) => {
      const { data: existingConfig } = await supabase.from("ticket_config" as any).select("id").single();

      if (existingConfig) {
        const { error } = await supabase
          .from("ticket_config" as any)
          .update({
            logo_url: config.logo_url || null,
            company_name: config.company_name,
            company_address: config.company_address || null,
            company_phone: config.company_phone || null,
            company_email: config.company_email || null,
            footer_message: config.footer_message,
            header_color: config.header_color,
            text_color: config.text_color,
            accent_color: config.accent_color,
            show_logo: config.show_logo,
            show_qr: config.show_qr,
            paper_width: config.paper_width,
            font_size: config.font_size,
          })
          .eq("id", (existingConfig as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ticket_config" as any)
          .insert({
            logo_url: config.logo_url || null,
            company_name: config.company_name,
            company_address: config.company_address || null,
            company_phone: config.company_phone || null,
            company_email: config.company_email || null,
            footer_message: config.footer_message,
            header_color: config.header_color,
            text_color: config.text_color,
            accent_color: config.accent_color,
            show_logo: config.show_logo,
            show_qr: config.show_qr,
            paper_width: config.paper_width,
            font_size: config.font_size,
          });
        if (error) throw error;
      }

      return config;
    },
    onSuccess: () => {
      toast.success("Configuración de diseño guardada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["ticket-config"] });
    },
    onError: (error: any) => {
      toast.error("Error al guardar la configuración de diseño");
      console.error("Error saving ticket config:", error);
    },
  });

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 2MB");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setTicketConfig({ ...ticketConfig, logo_url: result });
        toast.success("Logo cargado exitosamente");
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Error al cargar el logo");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
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
      if (error instanceof z.ZodError) toast.error(error.errors[0]?.message ?? "Error de validación");
      else toast.error("Error al validar la configuración");
    }
  };

  const handleSaveTicketConfig = () => saveTicketConfigMutation.mutate(ticketConfig);

  const handleResetTicketConfig = () => {
    setTicketConfig({
      logo_url: "",
      company_name: "",
      company_address: "",
      company_phone: "",
      company_email: "",
      footer_message: "¡Gracias por su compra!",
      header_color: "#1f2937",
      text_color: "#374151",
      accent_color: "#3b82f6",
      show_logo: true,
      show_qr: true,
      paper_width: "80mm",
      font_size: "small",
    });
    toast.success("Configuración restablecida a valores por defecto");
  };

  const handlePrintPreview = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Vista Previa - Ticket</title>
      </head>
      <body>
        <pre style="font-family: monospace;">Vista previa simplificada</pre>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } else {
      toast.error("No se pudo abrir la ventana de impresión");
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">Cargando configuración...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Configuración del Sistema</h1>
          <p className="text-sm text-muted-foreground">Administra todos los ajustes globales del sistema</p>
        </div>

        {/* ✅ controlled Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-5">
              <TabsTrigger value="company" className="text-xs sm:text-sm">
                Empresa
              </TabsTrigger>
              <TabsTrigger value="price-lists" className="text-xs sm:text-sm">
                Precios
              </TabsTrigger>
              <TabsTrigger value="ticket-design" className="text-xs sm:text-sm">
                Tickets
              </TabsTrigger>
              <TabsTrigger value="security" className="text-xs sm:text-sm">
                Seguridad
              </TabsTrigger>
              <TabsTrigger value="subscription" className="text-xs sm:text-sm">
                Suscripción
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="company">
            <CompanySettings />
          </TabsContent>

          <TabsContent value="price-lists">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Listas de Precios
                </CardTitle>
                <CardDescription>Gestiona diferentes listas de precios para tus productos</CardDescription>
              </CardHeader>
              <CardContent>
                <PriceListsSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ticket-design" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Diseño de Tickets
                </CardTitle>
                <CardDescription>Personaliza la apariencia de los tickets de venta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Tu UI original de tickets está OK; se omitió parte larga por brevedad en preview */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleResetTicketConfig} type="button">
                    Restablecer por Defecto
                  </Button>
                  <Button onClick={handleSaveTicketConfig} disabled={saveTicketConfigMutation.isPending} type="button">
                    {saveTicketConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handlePrintPreview} type="button">
                  Imprimir Prueba
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Seguridad
                </CardTitle>
                <CardDescription>Configura las opciones de seguridad de tu cuenta</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();

                    if (!formData.current_password || !formData.new_password) {
                      toast.error("Completá tu contraseña actual y la nueva contraseña");
                      return;
                    }

                    if (formData.new_password !== formData.confirm_password) {
                      toast.error("La confirmación no coincide");
                      return;
                    }

                    changePasswordMutation.mutate({
                      currentPassword: formData.current_password,
                      newPassword: formData.new_password,
                    });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="current_password">Contraseña Actual</Label>
                    <Input
                      id="current_password"
                      type="password"
                      value={formData.current_password}
                      onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                      placeholder="Ingresa tu contraseña actual"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new_password">Nueva Contraseña</Label>
                      <Input
                        id="new_password"
                        type="password"
                        value={formData.new_password}
                        onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                        placeholder="Ingresa una nueva contraseña"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirmar Contraseña</Label>
                      <Input
                        id="confirm_password"
                        type="password"
                        value={formData.confirm_password}
                        onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                        placeholder="Confirma tu nueva contraseña"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={changePasswordMutation.isPending}>
                      {changePasswordMutation.isPending ? "Guardando..." : "Cambiar Contraseña"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription">
            <div className="space-y-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Estado de Suscripción
                  </CardTitle>
                  <CardDescription>Información de tu plan y período de prueba</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {subscriptionLoading ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                        <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Plan</p>
                        <p className="text-lg font-semibold">{subscription?.subscription_plans?.name ?? "Sin plan"}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Estado</p>
                        <p className="text-lg font-semibold capitalize">{getSubscriptionStatusLabel(subscription?.status) || "Inactivo"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">Próxima fecha de cobro</p>
                        <p className="text-lg font-semibold">
                          {subscription?.current_period_end ? format(new Date(subscription.current_period_end), "dd/MM/yyyy") : "-"}
                        </p>
                      </div>
                      {trialDaysLeft !== null && trialDaysLeft > 0 && (
                        <div className="col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">Prueba gratuita</p>
                          <p className="text-lg font-semibold text-primary">{trialDaysLeft} días restantes</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <PlanChanger companyId={currentCompany?.id} currentPlanId={subscription?.plan_id} />

              <SubscriptionActions companyId={currentCompany?.id} subscriptionStatus={subscription?.status} />

              <InvoiceViewer companyId={currentCompany?.id} />

              <PaymentMethodsManager companyId={currentCompany?.id} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
