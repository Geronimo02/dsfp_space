import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Upload, Loader2, X } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
});

export function CompanySettings() {
  const { currentCompany, refreshCompanies } = useCompany();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
  });

  useEffect(() => {
    if (currentCompany) {
      const company = currentCompany as any;
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
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al subir el logo");
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof formData & { logo_url?: string }) => {
      if (!currentCompany) throw new Error("No hay empresa seleccionada");

      const result = companySchema.safeParse(data);
      if (!result.success) {
        throw new Error(result.error.errors[0].message);
      }

      const { error } = await supabase
        .from('companies')
        .update({
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
        })
        .eq('id', currentCompany.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración actualizada");
      refreshCompanies();
      queryClient.invalidateQueries({ queryKey: ['company', currentCompany?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (logoFile) {
      setUploading(true);
      await uploadLogoMutation.mutateAsync(logoFile);
      setUploading(false);
    } else {
      updateCompanyMutation.mutate(formData);
    }
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
                    onClick={() => {
                      setLogoPreview(null);
                      setLogoFile(null);
                    }}
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

          {/* Financial Settings */}
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
              <Label htmlFor="surcharge">Recargo tarjeta (%)</Label>
              <Input
                id="surcharge"
                type="number"
                step="0.01"
                value={formData.card_surcharge_rate}
                onChange={(e) => setFormData({ ...formData, card_surcharge_rate: parseFloat(e.target.value) || 0 })}
              />
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
