import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Upload, Loader2, X, DollarSign, Pencil, Check } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  tax_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  currency: z.string().length(3, "Código de moneda debe tener 3 caracteres"),
  default_tax_rate: z.number().min(0).max(100),
  card_surcharge_rate: z.number().min(0).max(100),
  whatsapp_number: z.string().optional(),
  whatsapp_enabled: z.boolean(),
  low_stock_alert: z.boolean(),
  receipt_footer: z.string().optional(),
  receipt_format: z.string().optional(),
  receipt_printer_name: z.string().optional(),
  loyalty_enabled: z.boolean(),
  loyalty_points_per_currency: z.number().min(0),
  loyalty_currency_per_point: z.number().min(0),
  loyalty_bronze_threshold: z.number().min(0),
  loyalty_silver_threshold: z.number().min(0),
  loyalty_gold_threshold: z.number().min(0),
  loyalty_bronze_discount: z.number().min(0).max(100),
  loyalty_silver_discount: z.number().min(0).max(100),
  loyalty_gold_discount: z.number().min(0).max(100),
  // Nuevos campos fiscales AFIP
  razon_social: z.string().optional(),
  nombre_fantasia: z.string().optional(),
  condicion_iva: z.string().optional(),
  inicio_actividades: z.string().optional(),
  certificado_afip_url: z.string().optional(),
  max_discount_percentage: z.number().min(0).max(100).optional(),
  max_installments: z.number().min(1).max(99).optional(),
  require_customer_document: z.boolean().optional(),
  autoprint_receipt: z.boolean().optional(),
});

export function CompanySettings() {
  const { currentCompany, refreshCompanies } = useCompany();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<string>("");

  // Query para obtener tipos de cambio
  const { data: exchangeRates = [], isLoading: loadingRates } = useQuery({
    queryKey: ["exchange-rates", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("currency");
      if (error) throw error;
      return data as Array<{ id: string; currency: string; rate: number; company_id: string }>;
    },
    enabled: !!currentCompany?.id,
  });

  // Query para obtener configuración de actualización automática
  const { data: exchangeRateSettings } = useQuery({
    queryKey: ["exchange-rate-settings", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from("exchange_rate_settings")
        .select("*")
        .eq("company_id", currentCompany.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as { 
        id: string; 
        company_id: string; 
        auto_update: boolean; 
        update_frequency: string;
        source: string;
        last_update: string | null;
      } | null;
    },
    enabled: !!currentCompany?.id,
  });

  const [formData, setFormData] = useState({
    name: "",
    tax_id: "",
    phone: "",
    email: "",
    address: "",
    currency: "ARS",
    default_tax_rate: 0,
    card_surcharge_rate: 0,
    whatsapp_number: "",
    whatsapp_enabled: false,
    low_stock_alert: true,
    receipt_footer: "",
    receipt_format: "thermal",
    receipt_printer_name: "",
    loyalty_enabled: false,
    loyalty_points_per_currency: 1,
    loyalty_currency_per_point: 0.01,
    loyalty_bronze_threshold: 0,
    loyalty_silver_threshold: 10000,
    loyalty_gold_threshold: 50000,
    loyalty_bronze_discount: 0,
    loyalty_silver_discount: 5,
    loyalty_gold_discount: 10,
    logo_url: null as string | null,
    // Campos fiscales AFIP
    razon_social: "",
    nombre_fantasia: "",
    condicion_iva: "responsable_inscripto",
    inicio_actividades: "",
    certificado_afip_url: "",
    clave_fiscal: "",
    max_discount_percentage: 10,
    max_installments: 12,
    require_customer_document: false,
    autoprint_receipt: false,
    // Campos integración AFIP
    cuit: "",
    afip_certificate: "",
    afip_private_key: "",
    afip_ambiente: "testing",
    afip_enabled: false,
  });

  useEffect(() => {
    if (currentCompany) {
      const company = currentCompany as any;
      console.log('Cargando configuración de la empresa:', company);
      console.log('card_surcharge_rate actual:', company.card_surcharge_rate);
      setFormData({
        name: company.name || "",
        tax_id: company.tax_id || "",
        phone: company.phone || "",
        email: company.email || "",
        address: company.address || "",
        currency: company.currency || "ARS",
        default_tax_rate: Number(company.default_tax_rate) || 0,
        card_surcharge_rate: Number(company.card_surcharge_rate) || 0,
        whatsapp_number: company.whatsapp_number || "",
        whatsapp_enabled: company.whatsapp_enabled || false,
        low_stock_alert: company.low_stock_alert ?? true,
        receipt_footer: company.receipt_footer || "",
        receipt_format: company.receipt_format || "thermal",
        receipt_printer_name: company.receipt_printer_name || "",
        loyalty_enabled: company.loyalty_enabled || false,
        loyalty_points_per_currency: Number(company.loyalty_points_per_currency) || 1,
        loyalty_currency_per_point: Number(company.loyalty_currency_per_point) || 0.01,
        loyalty_bronze_threshold: Number(company.loyalty_bronze_threshold) || 0,
        loyalty_silver_threshold: Number(company.loyalty_silver_threshold) || 10000,
        loyalty_gold_threshold: Number(company.loyalty_gold_threshold) || 50000,
        loyalty_bronze_discount: Number(company.loyalty_bronze_discount) || 0,
        loyalty_silver_discount: Number(company.loyalty_silver_discount) || 5,
        loyalty_gold_discount: Number(company.loyalty_gold_discount) || 10,
        logo_url: company.logo_url || null,
        // Campos fiscales AFIP
        razon_social: company.razon_social || "",
        nombre_fantasia: company.nombre_fantasia || "",
        condicion_iva: company.condicion_iva || "responsable_inscripto",
        inicio_actividades: company.inicio_actividades || "",
        certificado_afip_url: company.certificado_afip_url || "",
        clave_fiscal: company.clave_fiscal || "",
        max_discount_percentage: Number(company.max_discount_percentage) || 10,
        max_installments: Number(company.max_installments) || 12,
        require_customer_document: company.require_customer_document || false,
        autoprint_receipt: company.autoprint_receipt || false,
        // Campos integración AFIP
        cuit: company.cuit || "",
        afip_certificate: company.afip_certificate || "",
        afip_private_key: company.afip_private_key || "",
        afip_ambiente: company.afip_ambiente || "testing",
        afip_enabled: company.afip_enabled || false,
      });
      setLogoPreview(company.logo_url || null);
    }
  }, [currentCompany]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("El logo debe pesar menos de 2MB");
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCertificateUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'certificate' | 'privateKey'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      // Convert to base64
      const base64 = btoa(content);
      
      if (type === 'certificate') {
        setFormData({ ...formData, afip_certificate: base64 });
        toast.success("Certificado cargado correctamente");
      } else {
        setFormData({ ...formData, afip_private_key: base64 });
        toast.success("Clave privada cargada correctamente");
      }
    };
    reader.onerror = () => {
      toast.error("Error al leer el archivo");
    };
    reader.readAsText(file);
  };

  const handleTestAFIPConnection = async () => {
    if (!currentCompany?.id) return;
    
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('afip-auth', {
        body: {
          companyId: currentCompany.id,
          service: 'wsfe',
          ambiente: formData.afip_ambiente,
        },
      });

      if (error) throw error;

      if (data && data.token) {
        toast.success("✅ Conexión exitosa con AFIP");
      } else {
        toast.error("No se pudo obtener el token de AFIP");
      }
    } catch (error: any) {
      console.error('Error testing AFIP connection:', error);
      toast.error(error.message || "Error al conectar con AFIP");
    } finally {
      setTestingConnection(false);
    }
  };

  const updateExchangeRateMutation = useMutation({
    mutationFn: async ({ currency, rate }: { currency: string; rate: number }) => {
      if (!currentCompany?.id) throw new Error("No hay empresa seleccionada");
      
      const { error } = await supabase
        .from("exchange_rates")
        .upsert({
          currency,
          rate,
          company_id: currentCompany.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "currency,company_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tipo de cambio actualizado");
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      setEditingCurrency(null);
      setEditingRate("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar tipo de cambio");
    },
  });

  const handleSaveExchangeRate = (currency: string) => {
    const rate = parseFloat(editingRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Ingrese un tipo de cambio válido");
      return;
    }
    updateExchangeRateMutation.mutate({ currency, rate });
  };

  // Mutation para actualizar configuración de actualización automática
  const updateExchangeRateSettingsMutation = useMutation({
    mutationFn: async (settings: { auto_update: boolean; update_frequency?: string; source?: string }) => {
      if (!currentCompany?.id) throw new Error("No hay empresa seleccionada");
      
      const { error } = await supabase
        .from("exchange_rate_settings")
        .upsert({
          company_id: currentCompany.id,
          auto_update: settings.auto_update,
          update_frequency: settings.update_frequency || 'daily',
          source: settings.source || 'banco_nacion',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "company_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración actualizada");
      queryClient.invalidateQueries({ queryKey: ["exchange-rate-settings"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar configuración");
    },
  });

  // Mutation para actualizar tipos de cambio manualmente
  const updateExchangeRatesNowMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('update-exchange-rates', {
        body: {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Tipos de cambio actualizados: USD ${data.rates.USD}, EUR ${data.rates.EUR}`);
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      queryClient.invalidateQueries({ queryKey: ["exchange-rate-settings"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar tipos de cambio");
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!currentCompany) throw new Error("No hay empresa seleccionada");
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      return publicUrl;
    },
    onSuccess: (logoUrl) => {
      updateCompanyMutation.mutate({ ...formData, logo_url: logoUrl });
      setLogoFile(null);
      setLogoPreview(null);
      setUploading(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al subir el logo");
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof formData & { logo_url?: string }) => {
      if (!currentCompany) throw new Error("No hay empresa seleccionada");

      console.log('Guardando configuración:', data);

      const result = companySchema.safeParse(data);
      if (!result.success) {
        console.error('Error de validación:', result.error.errors);
        throw new Error(result.error.errors[0].message);
      }

      const updateData = {
        name: data.name,
        tax_id: data.tax_id || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        currency: data.currency,
        default_tax_rate: data.default_tax_rate,
        card_surcharge_rate: data.card_surcharge_rate,
        whatsapp_number: data.whatsapp_number || null,
        whatsapp_enabled: data.whatsapp_enabled,
        low_stock_alert: data.low_stock_alert,
        receipt_footer: data.receipt_footer || null,
        receipt_format: data.receipt_format,
        receipt_printer_name: data.receipt_printer_name || null,
        loyalty_enabled: data.loyalty_enabled,
        loyalty_points_per_currency: data.loyalty_points_per_currency,
        loyalty_currency_per_point: data.loyalty_currency_per_point,
        loyalty_bronze_threshold: data.loyalty_bronze_threshold,
        loyalty_silver_threshold: data.loyalty_silver_threshold,
        loyalty_gold_threshold: data.loyalty_gold_threshold,
        loyalty_bronze_discount: data.loyalty_bronze_discount,
        loyalty_silver_discount: data.loyalty_silver_discount,
        loyalty_gold_discount: data.loyalty_gold_discount,
        logo_url: data.logo_url || currentCompany.logo_url,
        // Campos fiscales
        razon_social: data.razon_social || null,
        nombre_fantasia: data.nombre_fantasia || null,
        condicion_iva: data.condicion_iva || 'responsable_inscripto',
        inicio_actividades: data.inicio_actividades || null,
        certificado_afip_url: data.certificado_afip_url || null,
        clave_fiscal: data.clave_fiscal || null,
        max_discount_percentage: data.max_discount_percentage || 10,
        max_installments: data.max_installments || 12,
        require_customer_document: data.require_customer_document || false,
        autoprint_receipt: data.autoprint_receipt || false,
        // Campos integración AFIP
        cuit: data.cuit || null,
        afip_certificate: data.afip_certificate || null,
        afip_private_key: data.afip_private_key || null,
        afip_ambiente: data.afip_ambiente || 'testing',
        afip_enabled: data.afip_enabled || false,
      } as any;

      console.log('Datos a actualizar:', updateData);

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', currentCompany.id);

      if (error) {
        console.error('Error de Supabase:', error);
        throw error;
      }

      // Recargar los datos actualizados
      const { data: updatedCompany } = await supabase
        .from('companies')
        .select('*')
        .eq('id', currentCompany.id)
        .single();
      
      return updatedCompany;
    },
    onSuccess: async () => {
      toast.success("Configuración actualizada");
      
      // Invalidar todas las queries relacionadas con la compañía
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['companies'] }),
        queryClient.invalidateQueries({ queryKey: ['company', currentCompany?.id] }),
        queryClient.invalidateQueries({ queryKey: ['company-settings', currentCompany?.id] }),
      ]);
      
      // Refrescar el contexto de la compañía
      await refreshCompanies();
      
      setLogoFile(null);
      setLogoPreview(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (logoFile) {
      setUploading(true);
      uploadLogoMutation.mutate(logoFile);
    } else {
      updateCompanyMutation.mutate(formData);
    }
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setLogoFile(null);
    setFormData({ ...formData, logo_url: null });
  };

  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No hay empresa seleccionada
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Información de la Empresa</CardTitle>
        </div>
        <CardDescription>
          Gestiona la información y configuración de {currentCompany.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo de la empresa</Label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <div className="relative">
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className="h-20 w-20 object-contain rounded border"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemoveLogo}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Label htmlFor="logo-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Subir logo</span>
                </div>
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </Label>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_id">CUIT / Tax ID</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
            />
          </div>

          {/* Currency and Exchange Rates */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Moneda y Tipos de Cambio</h3>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda Principal *</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">🇦🇷 Peso Argentino (ARS)</SelectItem>
                  <SelectItem value="USD">🇺🇸 Dólar Estadounidense (USD)</SelectItem>
                  <SelectItem value="EUR">🇪🇺 Euro (EUR)</SelectItem>
                  <SelectItem value="BRL">🇧🇷 Real Brasileño (BRL)</SelectItem>
                  <SelectItem value="CLP">🇨🇱 Peso Chileno (CLP)</SelectItem>
                  <SelectItem value="UYU">🇺🇾 Peso Uruguayo (UYU)</SelectItem>
                  <SelectItem value="MXN">🇲🇽 Peso Mexicano (MXN)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Esta será la moneda predeterminada para todas las transacciones
              </p>
            </div>

            <div className="space-y-3">
              <Label>Tipos de Cambio Manuales</Label>
              <p className="text-sm text-muted-foreground">
                Configure los tipos de cambio para convertir otras monedas a {formData.currency}
              </p>
              
              {loadingRates ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {["ARS", "USD", "EUR", "BRL", "CLP", "UYU", "MXN"]
                    .filter(curr => curr !== formData.currency)
                    .map((currency) => {
                      const existingRate = exchangeRates.find(r => r.currency === currency);
                      const isEditing = editingCurrency === currency;
                      
                      return (
                        <div key={currency} className="flex items-center gap-2 p-3 border rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium">{currency}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              → {formData.currency}
                            </span>
                          </div>
                          
                          {isEditing ? (
                            <>
                              <Input
                                type="number"
                                step="0.0001"
                                placeholder="Ej: 1000.00"
                                value={editingRate}
                                onChange={(e) => setEditingRate(e.target.value)}
                                className="w-32"
                                autoFocus
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveExchangeRate(currency)}
                                disabled={updateExchangeRateMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingCurrency(null);
                                  setEditingRate("");
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-sm">
                                {existingRate ? existingRate.rate.toFixed(4) : "No configurado"}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingCurrency(currency);
                                  setEditingRate(existingRate ? String(existingRate.rate) : "");
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Actualización Automática de Tipos de Cambio */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Actualización Automática de Tipos de Cambio</h3>
                <p className="text-sm text-muted-foreground">
                  Configure la actualización automática desde Banco Nación
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateExchangeRatesNowMutation.mutate()}
                disabled={updateExchangeRatesNowMutation.isPending}
              >
                {updateExchangeRatesNowMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Actualizar Ahora
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto_update">Actualización Automática</Label>
                  <Switch
                    id="auto_update"
                    checked={exchangeRateSettings?.auto_update ?? true}
                    onCheckedChange={(checked) => {
                      updateExchangeRateSettingsMutation.mutate({
                        auto_update: checked,
                        update_frequency: exchangeRateSettings?.update_frequency || 'daily',
                        source: exchangeRateSettings?.source || 'banco_nacion',
                      });
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Actualizar automáticamente desde Banco Nación
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="update_frequency">Frecuencia de Actualización</Label>
                <Select
                  value={exchangeRateSettings?.update_frequency || 'daily'}
                  onValueChange={(value) => {
                    updateExchangeRateSettingsMutation.mutate({
                      auto_update: exchangeRateSettings?.auto_update ?? true,
                      update_frequency: value,
                      source: exchangeRateSettings?.source || 'banco_nacion',
                    });
                  }}
                  disabled={!(exchangeRateSettings?.auto_update ?? true)}
                >
                  <SelectTrigger id="update_frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Cada hora</SelectItem>
                    <SelectItem value="daily">Diario</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {exchangeRateSettings?.last_update && (
              <div className="text-sm text-muted-foreground">
                Última actualización: {new Date(exchangeRateSettings.last_update).toLocaleString('es-AR', {
                  dateStyle: 'short',
                  timeStyle: 'short'
                })}
              </div>
            )}

            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-1">ℹ️ Fuente de datos: Banco Nación Argentina</p>
              <p className="text-muted-foreground">
                Los tipos de cambio se actualizan desde la API oficial del Banco Nación. 
                Se utilizan los valores de venta para USD y EUR.
              </p>
            </div>
          </div>

          {/* Fiscal Configuration AFIP */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-lg">Configuración Fiscal (AFIP)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="razon_social">Razón Social</Label>
                <Input
                  id="razon_social"
                  value={formData.razon_social}
                  onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  placeholder="Nombre legal de la empresa"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre oficial registrado ante AFIP
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre_fantasia">Nombre de Fantasía</Label>
                <Input
                  id="nombre_fantasia"
                  value={formData.nombre_fantasia}
                  onChange={(e) => setFormData({ ...formData, nombre_fantasia: e.target.value })}
                  placeholder="Nombre comercial"
                />
                <p className="text-xs text-muted-foreground">
                  Nombre comercial o marca
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condicion_iva">Condición IVA</Label>
                <Select
                  value={formData.condicion_iva}
                  onValueChange={(value) => setFormData({ ...formData, condicion_iva: value })}
                >
                  <SelectTrigger id="condicion_iva">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                    <SelectItem value="monotributista">Monotributista</SelectItem>
                    <SelectItem value="exento">Exento</SelectItem>
                    <SelectItem value="consumidor_final">Consumidor Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inicio_actividades">Inicio de Actividades</Label>
                <Input
                  id="inicio_actividades"
                  type="date"
                  value={formData.inicio_actividades}
                  onChange={(e) => setFormData({ ...formData, inicio_actividades: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="certificado_afip_url">Certificado AFIP (URL)</Label>
              <Input
                id="certificado_afip_url"
                value={formData.certificado_afip_url}
                onChange={(e) => setFormData({ ...formData, certificado_afip_url: e.target.value })}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                URL del certificado digital para facturación electrónica
              </p>
            </div>
          </div>

          {/* AFIP Certificate Configuration */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-lg">Certificado Digital AFIP</h3>
            <p className="text-sm text-muted-foreground">
              Configure su certificado digital para facturación electrónica. 
              <a href="https://www.afip.gob.ar/ws/documentacion/certificados.asp" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                ¿Cómo obtener mi certificado?
              </a>
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT</Label>
                <Input
                  id="cuit"
                  value={formData.cuit || ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      setFormData({ ...formData, cuit: value });
                    }
                  }}
                  placeholder="20123456789"
                  maxLength={11}
                />
                <p className="text-xs text-muted-foreground">
                  11 dígitos sin guiones
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="afip_ambiente">Ambiente AFIP</Label>
                <Select
                  value={formData.afip_ambiente || "testing"}
                  onValueChange={(value) => setFormData({ ...formData, afip_ambiente: value })}
                >
                  <SelectTrigger id="afip_ambiente">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="testing">🧪 Homologación (Testing)</SelectItem>
                    <SelectItem value="production">🔒 Producción</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use testing para pruebas
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="afip_certificate_file">Certificado (.crt)</Label>
              <div className="flex gap-2">
                <Input
                  id="afip_certificate_file"
                  type="file"
                  accept=".crt,.pem"
                  onChange={(e) => handleCertificateUpload(e, 'certificate')}
                  className="flex-1"
                />
                {formData.afip_certificate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFormData({ ...formData, afip_certificate: "" })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {formData.afip_certificate && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  ✓ Certificado cargado
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="afip_private_key_file">Clave Privada (.key)</Label>
              <div className="flex gap-2">
                <Input
                  id="afip_private_key_file"
                  type="file"
                  accept=".key,.pem"
                  onChange={(e) => handleCertificateUpload(e, 'privateKey')}
                  className="flex-1"
                />
                {formData.afip_private_key && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFormData({ ...formData, afip_private_key: "" })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {formData.afip_private_key && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  ✓ Clave privada cargada
                </p>
              )}
              <p className="text-xs text-yellow-600">
                ⚠️ La clave privada se almacenará encriptada
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-0.5">
                <Label>Habilitar Facturación Electrónica AFIP</Label>
                <p className="text-sm text-muted-foreground">
                  Activar integración con AFIP para facturación legal
                </p>
              </div>
              <Switch
                checked={formData.afip_enabled || false}
                onCheckedChange={(checked) => setFormData({ ...formData, afip_enabled: checked })}
                disabled={!formData.cuit || !formData.afip_certificate || !formData.afip_private_key}
              />
            </div>

            {formData.afip_enabled && (
              <Button
                type="button"
                variant="outline"
                onClick={handleTestAFIPConnection}
                disabled={testingConnection}
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Probando conexión...
                  </>
                ) : (
                  "Probar Conexión con AFIP"
                )}
              </Button>
            )}
          </div>

          {/* POS Configuration */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-lg">Parámetros de Punto de Venta</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_discount">Descuento Máximo (%)</Label>
                <Input
                  id="max_discount"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.max_discount_percentage}
                  onChange={(e) => setFormData({ ...formData, max_discount_percentage: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_installments">Cuotas Máximas</Label>
                <Input
                  id="max_installments"
                  type="number"
                  min="1"
                  max="99"
                  value={formData.max_installments}
                  onChange={(e) => setFormData({ ...formData, max_installments: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requerir documento del cliente</Label>
                  <p className="text-sm text-muted-foreground">
                    Solicitar DNI/CUIT obligatorio en ventas
                  </p>
                </div>
                <Switch
                  checked={formData.require_customer_document}
                  onCheckedChange={(checked) => setFormData({ ...formData, require_customer_document: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Impresión automática de tickets</Label>
                  <p className="text-sm text-muted-foreground">
                    Imprimir ticket automáticamente al finalizar venta
                  </p>
                </div>
                <Switch
                  checked={formData.autoprint_receipt}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoprint_receipt: checked })}
                />
              </div>
            </div>
          </div>

          {/* Financial Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">Configuración Actual de Recargos</p>
                <p className="text-xs text-muted-foreground">Recargo aplicado en pagos con tarjeta en cuotas</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {Number((currentCompany as any)?.card_surcharge_rate) || 0}%
                </p>
                <p className="text-xs text-muted-foreground">por cuota</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                  <SelectItem value="USD">USD - Dólar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_rate">Tasa de impuesto (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                step="0.01"
                value={formData.default_tax_rate}
                onChange={(e) => setFormData({ ...formData, default_tax_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surcharge">Recargo tarjeta de crédito (%)</Label>
              <Input
                id="surcharge"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Ej: 8 para 8% de recargo"
                value={formData.card_surcharge_rate ?? 0}
                onChange={(e) => {
                  const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  console.log('Nuevo valor de recargo:', value);
                  setFormData({ ...formData, card_surcharge_rate: value });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Se aplica por cuota en pagos con tarjeta. Ej: 8% en 3 cuotas = 24% de recargo total
                {formData.card_surcharge_rate > 0 && (
                  <span className="font-semibold text-primary ml-1">
                    (Actual: {formData.card_surcharge_rate}%)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alertas de stock bajo</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar cuando los productos alcancen el stock mínimo
                </p>
              </div>
              <Switch
                checked={formData.low_stock_alert}
                onCheckedChange={(checked) => setFormData({ ...formData, low_stock_alert: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>WhatsApp habilitado</Label>
                <p className="text-sm text-muted-foreground">
                  Permitir envío de notificaciones por WhatsApp
                </p>
              </div>
              <Switch
                checked={formData.whatsapp_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, whatsapp_enabled: checked })}
              />
            </div>

            {formData.whatsapp_enabled && (
              <div className="space-y-2 pl-4">
                <Label htmlFor="whatsapp_number">Número de WhatsApp</Label>
                <Input
                  id="whatsapp_number"
                  placeholder="+54 9 11 1234-5678"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Receipt Settings */}
          <div className="space-y-4">
            <h3 className="font-medium">Configuración de tickets</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receipt_format">Formato</Label>
                <Select
                  value={formData.receipt_format}
                  onValueChange={(value) => setFormData({ ...formData, receipt_format: value })}
                >
                  <SelectTrigger id="receipt_format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thermal">Térmico (80mm)</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="printer_name">Nombre de impresora</Label>
                <Input
                  id="printer_name"
                  value={formData.receipt_printer_name}
                  onChange={(e) => setFormData({ ...formData, receipt_printer_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt_footer">Pie de ticket</Label>
              <Textarea
                id="receipt_footer"
                value={formData.receipt_footer}
                onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                rows={2}
                placeholder="¡Gracias por su compra!"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={uploading || updateCompanyMutation.isPending}
          >
            {(uploading || updateCompanyMutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Guardar cambios
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
