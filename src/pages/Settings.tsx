import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Building2, DollarSign, Receipt, MessageSquare, Database, AlertTriangle, Package, Users, Palette, FileText, Upload, Eye, Lock, CreditCard } from "lucide-react";
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
  const { currentCompany } = useCompany();
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

  const { data: subscription } = useQuery({
    queryKey: ["subscription", currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, company_id, plan_id, provider, status, trial_ends_at, provider_customer_id, mp_preapproval_id, stripe_payment_method_id")
        .eq("company_id", currentCompany!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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
      
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", currentCompany.id)
        .single();
      
      if (error) throw error;
      
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Update form when settings load
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
      const { data: { user } } = await supabase.auth.getUser();
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

  const { data: ticketConfigData, isLoading: isLoadingTicketConfig } = useQuery({
    queryKey: ["ticket-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_config" as any)
        .select("*")
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }
      
      if (data) {
        // Actualizar el estado con los datos de la base de datos
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
      // Intentar actualizar primero
      const { data: existingConfig } = await supabase
        .from("ticket_config" as any)
        .select("id")
        .single();

      if (existingConfig) {
        // Actualizar configuración existente
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
        // Crear nueva configuración
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

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor selecciona un archivo de imagen válido");
      return;
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 2MB");
      return;
    }

    try {
      // Convertir a base64 para preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setTicketConfig({...ticketConfig, logo_url: result});
        toast.success("Logo cargado exitosamente");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Error al cargar el logo");
    }
  };

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

  const handleSaveTicketConfig = () => {
    saveTicketConfigMutation.mutate(ticketConfig);
  };

  const handleResetTicketConfig = () => {
    const defaultConfig = {
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
    };
    
    setTicketConfig(defaultConfig);
    toast.success("Configuración restablecida a valores por defecto");
  };

  const handlePrintPreview = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Vista Previa - Ticket</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: 'Courier New', monospace;
            display: flex;
            justify-content: center;
            background-color: #f5f5f5;
          }
          .ticket {
            width: ${ticketConfig.paper_width === 'A4' ? '210mm' : 
                     ticketConfig.paper_width === '80mm' ? '80mm' : '58mm'};
            background: white;
            padding: 10px;
            border: 1px solid #ddd;
            font-size: ${ticketConfig.font_size === 'large' ? '14px' : 
                        ticketConfig.font_size === 'medium' ? '12px' : '10px'};
            color: ${ticketConfig.text_color};
          }
          .header {
            text-align: center;
            background-color: ${ticketConfig.header_color};
            color: white;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 15px;
          }
          .logo {
            width: 48px;
            height: 48px;
            margin: 0 auto 8px;
            background: white/20;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
          .company-name {
            font-weight: bold;
            font-size: 1.1em;
            margin: 5px 0;
          }
          .company-info {
            font-size: 0.9em;
            opacity: 0.9;
            margin: 2px 0;
          }
          .sale-info {
            margin-bottom: 10px;
            font-size: 0.9em;
          }
          .line {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .items {
            margin: 10px 0;
          }
          .item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .item-detail {
            font-size: 0.8em;
            color: #666;
            margin-left: 10px;
          }
          .totals {
            border-top: 1px dashed #000;
            margin-top: 10px;
            padding-top: 5px;
          }
          .grand-total {
            font-weight: bold;
            color: ${ticketConfig.accent_color};
            font-size: 1.1em;
            border-top: 1px solid #000;
            padding-top: 5px;
            margin-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 15px;
            font-size: 0.9em;
          }
          .qr-placeholder {
            width: 48px;
            height: 48px;
            background: #e5e5e5;
            margin: 10px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
          }
          hr {
            border: none;
            border-top: 1px dashed #000;
            margin: 10px 0;
          }
          @media print {
            body { background: white; }
            .ticket { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            ${ticketConfig.show_logo ? `
              <div class="logo">
                ${ticketConfig.logo_url ? 
                  `<img src="${ticketConfig.logo_url}" alt="Logo" />` : 
                  'LOGO'
                }
              </div>
            ` : ''}
            <div class="company-name">${ticketConfig.company_name || "NOMBRE EMPRESA"}</div>
            ${ticketConfig.company_address ? `<div class="company-info">${ticketConfig.company_address}</div>` : ''}
            ${ticketConfig.company_phone ? `<div class="company-info">${ticketConfig.company_phone}</div>` : ''}
            ${ticketConfig.company_email ? `<div class="company-info">${ticketConfig.company_email}</div>` : ''}
          </div>

          <div class="sale-info">
            <div class="line">
              <span>Ticket #:</span>
              <span>001-000001</span>
            </div>
            <div class="line">
              <span>Fecha:</span>
              <span>${format(new Date(), "dd/MM/yyyy HH:mm")}</span>
            </div>
            <div class="line">
              <span>Cajero:</span>
              <span>Admin</span>
            </div>
          </div>

          <hr>

          <div class="items">
            <div class="item">
              <span>Producto Ejemplo</span>
              <span>$10.00</span>
            </div>
            <div class="item-detail">2 x $5.00</div>
            
            <div class="item">
              <span>Otro Producto</span>
              <span>$15.50</span>
            </div>
            <div class="item-detail">1 x $15.50</div>
          </div>

          <hr>

          <div class="totals">
            <div class="line">
              <span>Subtotal:</span>
              <span>$25.50</span>
            </div>
            <div class="line">
              <span>Impuestos:</span>
              <span>$2.55</span>
            </div>
            <div class="line grand-total">
              <span>TOTAL:</span>
              <span>$28.05</span>
            </div>
          </div>

          <hr>

          <div class="footer">
            <div>${ticketConfig.footer_message}</div>
            ${ticketConfig.show_qr ? `
              <div class="qr-placeholder">QR</div>
            ` : ''}
            <div style="font-size: 0.8em; opacity: 0.7;">www.miempresa.com</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Esperar a que cargue y luego imprimir
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      toast.error("No se pudo abrir la ventana de impresión");
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
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Configuración del Sistema</h1>
          <p className="text-sm text-muted-foreground">Administra todos los ajustes globales del sistema</p>
        </div>

        <Tabs defaultValue="company" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-5">
              <TabsTrigger value="company" className="text-xs sm:text-sm">Empresa</TabsTrigger>
              <TabsTrigger value="price-lists" className="text-xs sm:text-sm">Precios</TabsTrigger>
              <TabsTrigger value="ticket-design" className="text-xs sm:text-sm">Tickets</TabsTrigger>
              <TabsTrigger value="security" className="text-xs sm:text-sm">Seguridad</TabsTrigger>
              <TabsTrigger value="subscription" className="text-xs sm:text-sm">Suscripción</TabsTrigger>
            </TabsList>
          </div>

          {/* Company */}
          <TabsContent value="company">
            <CompanySettings />
          </TabsContent>

          {/* Price Lists */}
          <TabsContent value="price-lists">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Listas de Precios
                </CardTitle>
                <CardDescription>
                  Gestiona diferentes listas de precios para tus productos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PriceListsSettings />
              </CardContent>
            </Card>
          </TabsContent>

          {/* General - eliminado (duplicaba configuración de Empresa) */}


          {/* Diseño de Tickets */}
          <TabsContent value="ticket-design" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Diseño de Tickets
                </CardTitle>
                <CardDescription>
                  Personaliza la apariencia de los tickets de venta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Vista Previa */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Configuración */}
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Información de la Empresa
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="company-name">Nombre de la Empresa</Label>
                          <Input
                            id="company-name"
                            value={ticketConfig.company_name}
                            onChange={(e) => setTicketConfig({...ticketConfig, company_name: e.target.value})}
                            placeholder="Mi Empresa S.A."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="company-phone">Teléfono</Label>
                          <Input
                            id="company-phone"
                            value={ticketConfig.company_phone}
                            onChange={(e) => setTicketConfig({...ticketConfig, company_phone: e.target.value})}
                            placeholder="+1234567890"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company-address">Dirección</Label>
                        <Textarea
                          id="company-address"
                          value={ticketConfig.company_address}
                          onChange={(e) => setTicketConfig({...ticketConfig, company_address: e.target.value})}
                          placeholder="Calle Ejemplo 123, Ciudad, País"
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company-email">Email</Label>
                        <Input
                          id="company-email"
                          type="email"
                          value={ticketConfig.company_email}
                          onChange={(e) => setTicketConfig({...ticketConfig, company_email: e.target.value})}
                          placeholder="contacto@miempresa.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="footer-message">Mensaje del Pie</Label>
                        <Textarea
                          id="footer-message"
                          value={ticketConfig.footer_message}
                          onChange={(e) => setTicketConfig({...ticketConfig, footer_message: e.target.value})}
                          placeholder="¡Gracias por su compra!"
                          rows={2}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Colores y Estilo
                      </h4>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="header-color">Color del Encabezado</Label>
                          <div className="flex gap-2">
                            <Input
                              id="header-color"
                              type="color"
                              value={ticketConfig.header_color}
                              onChange={(e) => setTicketConfig({...ticketConfig, header_color: e.target.value})}
                              className="w-12 h-10 p-1 border rounded"
                            />
                            <Input
                              value={ticketConfig.header_color}
                              onChange={(e) => setTicketConfig({...ticketConfig, header_color: e.target.value})}
                              placeholder="#1f2937"
                              className="flex-1"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="text-color">Color del Texto</Label>
                          <div className="flex gap-2">
                            <Input
                              id="text-color"
                              type="color"
                              value={ticketConfig.text_color}
                              onChange={(e) => setTicketConfig({...ticketConfig, text_color: e.target.value})}
                              className="w-12 h-10 p-1 border rounded"
                            />
                            <Input
                              value={ticketConfig.text_color}
                              onChange={(e) => setTicketConfig({...ticketConfig, text_color: e.target.value})}
                              placeholder="#374151"
                              className="flex-1"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="accent-color">Color de Acento</Label>
                          <div className="flex gap-2">
                            <Input
                              id="accent-color"
                              type="color"
                              value={ticketConfig.accent_color}
                              onChange={(e) => setTicketConfig({...ticketConfig, accent_color: e.target.value})}
                              className="w-12 h-10 p-1 border rounded"
                            />
                            <Input
                              value={ticketConfig.accent_color}
                              onChange={(e) => setTicketConfig({...ticketConfig, accent_color: e.target.value})}
                              placeholder="#3b82f6"
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="paper-width">Ancho del Papel</Label>
                          <select
                            id="paper-width"
                            title="Seleccionar ancho del papel"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={ticketConfig.paper_width}
                            onChange={(e) => setTicketConfig({...ticketConfig, paper_width: e.target.value})}
                          >
                            <option value="58mm">58mm (Mini)</option>
                            <option value="80mm">80mm (Estándar)</option>
                            <option value="A4">A4 (Carta)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="font-size">Tamaño de Fuente</Label>
                          <select
                            id="font-size"
                            title="Seleccionar tamaño de fuente"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={ticketConfig.font_size}
                            onChange={(e) => setTicketConfig({...ticketConfig, font_size: e.target.value})}
                          >
                            <option value="small">Pequeña</option>
                            <option value="medium">Mediana</option>
                            <option value="large">Grande</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-logo"
                            title="Mostrar logo en el ticket"
                            checked={ticketConfig.show_logo}
                            onChange={(e) => setTicketConfig({...ticketConfig, show_logo: e.target.checked})}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="show-logo">Mostrar Logo</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="show-qr"
                            title="Mostrar código QR en el ticket"
                            checked={ticketConfig.show_qr}
                            onChange={(e) => setTicketConfig({...ticketConfig, show_qr: e.target.checked})}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="show-qr">Mostrar Código QR</Label>
                        </div>
                      </div>

                      {ticketConfig.show_logo && (
                        <div className="space-y-2">
                          <Label htmlFor="logo-upload">Logo de la Empresa</Label>
                          <div className="flex gap-2">
                            <Input
                              id="logo-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="flex-1"
                            />
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => document.getElementById('logo-upload')?.click()}
                              type="button"
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          </div>
                          {ticketConfig.logo_url && (
                            <div className="mt-2">
                              <img 
                                src={ticketConfig.logo_url} 
                                alt="Logo" 
                                className="w-20 h-20 object-contain border rounded mx-auto"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTicketConfig({...ticketConfig, logo_url: ""})}
                                className="mt-2 w-full"
                                type="button"
                              >
                                Quitar Logo
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vista Previa */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Vista Previa
                      </h4>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handlePrintPreview}
                        type="button"
                      >
                        Imprimir Prueba
                      </Button>
                    </div>

                    <div 
                      className="border rounded-lg p-4 bg-white" 
                      style={{ 
                        width: ticketConfig.paper_width === 'A4' ? '210mm' : 
                               ticketConfig.paper_width === '80mm' ? '80mm' : '58mm',
                        fontSize: ticketConfig.font_size === 'large' ? '14px' : 
                                ticketConfig.font_size === 'medium' ? '12px' : '10px',
                        color: ticketConfig.text_color,
                        maxWidth: '300px',
                        margin: '0 auto'
                      }}
                    >
                      {/* Encabezado */}
                      <div 
                        className="text-center mb-4" 
                        style={{ 
                          backgroundColor: ticketConfig.header_color,
                          color: 'white',
                          padding: '8px',
                          borderRadius: '4px'
                        }}
                      >
                        {ticketConfig.show_logo && (
                          <div className="mb-2">
                            <div className="w-12 h-12 bg-white/20 rounded mx-auto flex items-center justify-center overflow-hidden">
                              {ticketConfig.logo_url ? (
                                <img 
                                  src={ticketConfig.logo_url} 
                                  alt="Logo" 
                                  className="max-w-full max-h-full object-contain"
                                />
                              ) : (
                                <span className="text-xs">LOGO</span>
                              )}
                            </div>
                          </div>
                        )}
                        <h3 className="font-bold text-sm">{ticketConfig.company_name || "NOMBRE EMPRESA"}</h3>
                        <p className="text-xs opacity-90">{ticketConfig.company_address || "Dirección de la empresa"}</p>
                        <p className="text-xs opacity-90">{ticketConfig.company_phone || "Teléfono"}</p>
                        <p className="text-xs opacity-90">{ticketConfig.company_email || "email@empresa.com"}</p>
                      </div>

                      {/* Información de venta */}
                      <div className="mb-3 text-xs">
                        <div className="flex justify-between">
                          <span>Ticket #:</span>
                          <span>001-000001</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fecha:</span>
                          <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cajero:</span>
                          <span>Admin</span>
                        </div>
                      </div>

                      <hr className="my-2" />

                      {/* Productos de ejemplo */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Producto Ejemplo</span>
                          <span>$10.00</span>
                        </div>
                        <div className="text-xs text-gray-600 ml-2">
                          2 x $5.00
                        </div>
                        <div className="flex justify-between text-xs mb-1">
                          <span>Otro Producto</span>
                          <span>$15.50</span>
                        </div>
                        <div className="text-xs text-gray-600 ml-2">
                          1 x $15.50
                        </div>
                      </div>

                      <hr className="my-2" />

                      {/* Totales */}
                      <div className="mb-3 text-xs">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>$25.50</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Impuestos:</span>
                          <span>$2.55</span>
                        </div>
                        <div className="flex justify-between font-bold" style={{ color: ticketConfig.accent_color }}>
                          <span>TOTAL:</span>
                          <span>$28.05</span>
                        </div>
                      </div>

                      <hr className="my-2" />

                      {/* Pie */}
                      <div className="text-center text-xs">
                        <p className="mb-2">{ticketConfig.footer_message}</p>
                        {ticketConfig.show_qr && (
                          <div className="flex justify-center mb-2">
                            <div className="w-12 h-12 bg-gray-200 flex items-center justify-center text-xs">
                              QR
                            </div>
                          </div>
                        )}
                        <p className="text-xs opacity-70">www.miempresa.com</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline"
                    onClick={handleResetTicketConfig}
                    type="button"
                  >
                    Restablecer por Defecto
                  </Button>
                  <Button
                    onClick={handleSaveTicketConfig}
                    disabled={saveTicketConfigMutation.isPending}
                    type="button"
                  >
                    {saveTicketConfigMutation.isPending ? "Guardando..." : "Guardar Configuración"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Seguridad */}
          <TabsContent value="security" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Seguridad
                </CardTitle>
                <CardDescription>
                  Configura las opciones de seguridad de tu cuenta
                </CardDescription>
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

          {/* Subscription */}
          <TabsContent value="subscription">
            <div className="space-y-6">
              {/* Subscription Status */}
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Estado de Suscripción
                  </CardTitle>
                  <CardDescription>Información de tu plan y período de prueba</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Plan</p>
                      <p className="text-lg font-semibold">{subscription?.plan_id ?? "Sin plan"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Proveedor</p>
                      <p className="text-lg font-semibold capitalize">{subscription?.provider ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Prueba gratuita</p>
                      <p className="text-lg font-semibold">
                        {trialDaysLeft !== null ? `${trialDaysLeft} días restantes` : "No activa"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Estado</p>
                      <p className="text-lg font-semibold capitalize">{subscription?.status ?? "Inactivo"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <PaymentMethodsManager companyId={currentCompany?.id} />
            </div>
          </TabsContent>

          {/* Integraciones - eliminado (duplicaba configuración de Empresa) */}


          {/* Sistema - eliminado (sección no utilizada) */}
        </Tabs>
      </div>
    </Layout>
  );
}
