import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Palette, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";

interface TicketConfig {
  logo_url: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  footer_message: string;
  header_color: string;
  text_color: string;
  accent_color: string;
  show_logo: boolean;
  show_qr: boolean;
  paper_width: string;
  font_size: string;
}

const defaultTicketConfig: TicketConfig = {
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

export function TicketDesignSettings() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [ticketConfig, setTicketConfig] = useState<TicketConfig>(defaultTicketConfig);

  const { data: ticketConfigData, isLoading: isLoadingTicketConfig } = useQuery({
    queryKey: ["ticket-config", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;

      const { data, error } = await supabase
        .from("ticket_config" as any)
        .select("*")
        .eq("company_id", currentCompany.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

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
    enabled: !!currentCompany?.id,
  });

  const saveTicketConfigMutation = useMutation({
    mutationFn: async (config: typeof ticketConfig) => {
      if (!currentCompany?.id) throw new Error("No company selected");

      const { data: existingConfig } = await supabase
        .from("ticket_config" as any)
        .select("id")
        .eq("company_id", currentCompany.id)
        .maybeSingle();

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
            company_id: currentCompany.id,
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
      queryClient.invalidateQueries({ queryKey: ["ticket-config", currentCompany?.id] });
    },
    onError: (error: any) => {
      toast.error("Error al guardar la configuración de diseño: " + (error?.message || "Error desconocido"));
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
    } catch (error) {
      toast.error("Error al cargar el logo");
    }
  };

  const handleResetTicketConfig = () => {
    setTicketConfig(defaultTicketConfig);
  };

  const handleSaveTicketConfig = () => {
    saveTicketConfigMutation.mutate(ticketConfig);
  };

  if (isLoadingTicketConfig) {
    return <div>Cargando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Diseño de Tickets
        </CardTitle>
        <CardDescription>Personaliza la apariencia de los tickets de venta</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
                    onChange={(e) => setTicketConfig({ ...ticketConfig, company_name: e.target.value })}
                    placeholder="Mi Empresa S.A."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Teléfono</Label>
                  <Input
                    id="company-phone"
                    value={ticketConfig.company_phone}
                    onChange={(e) => setTicketConfig({ ...ticketConfig, company_phone: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-address">Dirección</Label>
                <Textarea
                  id="company-address"
                  value={ticketConfig.company_address}
                  onChange={(e) => setTicketConfig({ ...ticketConfig, company_address: e.target.value })}
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
                  onChange={(e) => setTicketConfig({ ...ticketConfig, company_email: e.target.value })}
                  placeholder="contacto@miempresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="footer-message">Mensaje del Pie</Label>
                <Textarea
                  id="footer-message"
                  value={ticketConfig.footer_message}
                  onChange={(e) => setTicketConfig({ ...ticketConfig, footer_message: e.target.value })}
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
                      onChange={(e) => setTicketConfig({ ...ticketConfig, header_color: e.target.value })}
                      className="w-12 h-10 p-1 border rounded"
                    />
                    <Input
                      value={ticketConfig.header_color}
                      onChange={(e) => setTicketConfig({ ...ticketConfig, header_color: e.target.value })}
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
                      onChange={(e) => setTicketConfig({ ...ticketConfig, text_color: e.target.value })}
                      className="w-12 h-10 p-1 border rounded"
                    />
                    <Input
                      value={ticketConfig.text_color}
                      onChange={(e) => setTicketConfig({ ...ticketConfig, text_color: e.target.value })}
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
                      onChange={(e) => setTicketConfig({ ...ticketConfig, accent_color: e.target.value })}
                      className="w-12 h-10 p-1 border rounded"
                    />
                    <Input
                      value={ticketConfig.accent_color}
                      onChange={(e) => setTicketConfig({ ...ticketConfig, accent_color: e.target.value })}
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
                    onChange={(e) => setTicketConfig({ ...ticketConfig, paper_width: e.target.value })}
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
                    onChange={(e) => setTicketConfig({ ...ticketConfig, font_size: e.target.value })}
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
                    onChange={(e) => setTicketConfig({ ...ticketConfig, show_logo: e.target.checked })}
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
                    onChange={(e) => setTicketConfig({ ...ticketConfig, show_qr: e.target.checked })}
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
                      onClick={() => document.getElementById("logo-upload")?.click()}
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
                        onClick={() => setTicketConfig({ ...ticketConfig, logo_url: "" })}
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

          {/* Preview */}
          <div className="flex items-center justify-center">
            <div
              className="border rounded-lg p-4 text-center"
              style={{
                width: "100%",
                maxWidth: "300px",
                backgroundColor: ticketConfig.header_color,
              }}
            >
              {ticketConfig.show_logo && ticketConfig.logo_url && (
                <div className="mb-2">
                  <img
                    src={ticketConfig.logo_url}
                    alt="Logo"
                    className="w-12 h-12 mx-auto object-contain rounded"
                  />
                </div>
              )}

              <div style={{ color: ticketConfig.text_color }}>
                <h3 className="font-bold text-xs mb-1">{ticketConfig.company_name || "Mi Empresa"}</h3>
                <p className="text-xs mb-1">{ticketConfig.company_address || "Dirección"}</p>
                <p className="text-xs">{ticketConfig.company_phone || "Teléfono"}</p>
              </div>

              <hr style={{ borderColor: ticketConfig.accent_color }} className="my-2" />

              <div style={{ color: ticketConfig.text_color }}>
                <p className="text-xs font-mono mb-2">
                  COMPROBANTE #{String(123456).padStart(6, "0")}
                </p>
                <p className="text-xs">12/02/2026 14:30</p>
              </div>

              <hr style={{ borderColor: ticketConfig.accent_color }} className="my-2" />

              <div
                className="text-xs font-mono text-left space-y-0.5"
                style={{ color: ticketConfig.text_color }}
              >
                <div className="flex justify-between">
                  <span>Producto A</span>
                  <span>1 x $10</span>
                </div>
                <div className="flex justify-between">
                  <span>Producto B</span>
                  <span>2 x $7.5</span>
                </div>
              </div>

              <div
                style={{ color: ticketConfig.text_color }}
                className="mb-3 text-xs"
              >
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

              <hr style={{ borderColor: ticketConfig.accent_color }} className="my-2" />

              <div className="text-center text-xs" style={{ color: ticketConfig.text_color }}>
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
  );
}
