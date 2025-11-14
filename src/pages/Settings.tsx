import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Building2, DollarSign, Receipt, MessageSquare, Database, AlertTriangle, Package, Users, Palette, FileText, Upload, Eye, Lock } from "lucide-react";
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

import { CompanySettings } from "@/components/settings/CompanySettings";

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

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .single();
      
      if (error) throw error;
      
      // Update form with loaded data
      setFormData({
        company_name: data.name || "",
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
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      
      return data;
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!settings?.id) throw new Error("No settings found");
      
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configuración del Sistema</h1>
          <p className="text-muted-foreground">Administra todos los ajustes globales del sistema</p>
        </div>

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="company">Empresa</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="ticket-design">Diseño de Tickets</TabsTrigger>
            <TabsTrigger value="security">Seguridad</TabsTrigger>
            <TabsTrigger value="integrations">Integraciones</TabsTrigger>
          </TabsList>

          {/* Company */}
          <TabsContent value="company">
            <CompanySettings />
          </TabsContent>

          {/* General */}
          <TabsContent value="general" className="space-y-6">
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

            {/* Finanzas */}
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

            {/* Programa de Fidelización */}
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

            {/* Tickets */}
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
                <form onSubmit={handleSubmit} className="space-y-4">
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
