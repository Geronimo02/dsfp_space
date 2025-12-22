import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Receipt, AlertCircle, Loader2, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AFIPInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleData: {
    id: string;
    sale_number: string;
    total: number;
    subtotal: number;
    customer?: {
      id: string;
      name: string;
      tipo_documento?: string;
      numero_documento?: string;
      condicion_iva?: string;
    };
  } | null;
  companyId: string;
  onSuccess?: (result: any) => void;
}

const TIPOS_DOCUMENTO = [
  { value: "80", label: "CUIT" },
  { value: "86", label: "CUIL" },
  { value: "96", label: "DNI" },
  { value: "99", label: "Sin identificar" },
];

const TIPOS_COMPROBANTE = [
  { value: "1", label: "Factura A", code: "FACTURA_A" },
  { value: "6", label: "Factura B", code: "FACTURA_B" },
  { value: "11", label: "Factura C", code: "FACTURA_C" },
  { value: "3", label: "Nota de Crédito A", code: "NC_A" },
  { value: "8", label: "Nota de Crédito B", code: "NC_B" },
];

const CONDICIONES_IVA = [
  { value: "IVA Responsable Inscripto", label: "Resp. Inscripto", tipoFactura: "1" },
  { value: "IVA Responsable No Inscripto", label: "Resp. No Inscripto", tipoFactura: "6" },
  { value: "IVA Sujeto Exento", label: "Exento", tipoFactura: "6" },
  { value: "Consumidor Final", label: "Consumidor Final", tipoFactura: "6" },
  { value: "Responsable Monotributo", label: "Monotributo", tipoFactura: "6" },
];

export function AFIPInvoiceDialog({ 
  open, 
  onOpenChange, 
  saleData, 
  companyId,
  onSuccess 
}: AFIPInvoiceDialogProps) {
  const [tipoComprobante, setTipoComprobante] = useState("6"); // Default Factura B
  const [tipoDocumento, setTipoDocumento] = useState("96"); // Default DNI
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [selectedPOSId, setSelectedPOSId] = useState("");

  // Fetch AFIP POS points
  const { data: posPoints } = useQuery({
    queryKey: ["pos-afip-active", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pos_afip")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("punto_venta");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!companyId,
  });

  // Fetch company AFIP config
  const { data: companyConfig } = useQuery({
    queryKey: ["company-afip-config", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("cuit, razon_social, condicion_iva, afip_enabled, afip_ambiente")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!companyId,
  });

  // Initialize values when dialog opens
  useState(() => {
    if (saleData?.customer) {
      const tipoDoc = saleData.customer.tipo_documento === "CUIT" ? "80" : 
                      saleData.customer.tipo_documento === "DNI" ? "96" : "99";
      setTipoDocumento(tipoDoc);
      setNumeroDocumento(saleData.customer.numero_documento || "");
      
      // Determine invoice type based on customer's IVA condition
      const condicion = CONDICIONES_IVA.find(c => c.value === saleData.customer?.condicion_iva);
      if (condicion) {
        setTipoComprobante(condicion.tipoFactura);
      }
    }
  });

  const emitirComprobante = useMutation({
    mutationFn: async () => {
      if (!selectedPOSId) throw new Error("Seleccione un punto de venta");
      if (!saleData) throw new Error("No hay datos de venta");
      
      const pos = posPoints?.find((p: any) => p.id === selectedPOSId);
      if (!pos) throw new Error("Punto de venta no encontrado");

      // Calculate IVA (assuming 21%)
      const ivaRate = 21;
      const importeNeto = saleData.subtotal;
      const importeIVA = importeNeto * (ivaRate / 100);
      const importeTotal = saleData.total;

      const payload = {
        companyId,
        posAfipId: selectedPOSId,
        puntoVenta: pos.punto_venta,
        tipoComprobante: parseInt(tipoComprobante),
        concepto: 1, // Productos
        fecha: format(new Date(), "yyyy-MM-dd"),
        clienteDocTipo: parseInt(tipoDocumento),
        clienteDocNro: numeroDocumento.replace(/\D/g, ""),
        importeTotal,
        importeNeto,
        importeIVA,
        importeTributos: 0,
        importeExento: 0,
        importeNoGravado: 0,
        iva: [{
          id: 5, // 21%
          baseImp: importeNeto,
          importe: importeIVA,
        }],
        ambiente: companyConfig?.afip_ambiente || "testing",
        saleId: saleData.id,
      };

      const { data, error } = await supabase.functions.invoke("afip-facturar", {
        body: payload,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Error al emitir comprobante");

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Comprobante emitido: ${data.numeroComprobante}`);
      if (onSuccess) onSuccess(data);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al emitir comprobante AFIP");
    },
  });

  if (!saleData) return null;

  const isAFIPEnabled = companyConfig?.afip_enabled;
  const ambiente = companyConfig?.afip_ambiente || "testing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Emitir Comprobante AFIP
          </DialogTitle>
          <DialogDescription>
            Generar factura electrónica para la venta {saleData.sale_number}
          </DialogDescription>
        </DialogHeader>

        {!isAFIPEnabled ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              La facturación AFIP no está habilitada para esta empresa. 
              Configure los certificados en Configuración → AFIP.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {ambiente === "testing" && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-600">
                  Modo HOMOLOGACIÓN - Los comprobantes no tienen validez fiscal
                </AlertDescription>
              </Alert>
            )}

            {/* Resumen de venta */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>${saleData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA (21%):</span>
                <span>${(saleData.subtotal * 0.21).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>${saleData.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Punto de Venta */}
            <div className="space-y-2">
              <Label>Punto de Venta *</Label>
              <Select value={selectedPOSId} onValueChange={setSelectedPOSId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar punto de venta" />
                </SelectTrigger>
                <SelectContent>
                  {posPoints?.map((pos: any) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      PV {String(pos.punto_venta).padStart(4, "0")} - {pos.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Comprobante */}
            <div className="space-y-2">
              <Label>Tipo de Comprobante *</Label>
              <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_COMPROBANTE.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Datos del Cliente */}
            <div className="space-y-4">
              <h4 className="font-medium">Datos del Cliente</h4>
              
              {saleData.customer ? (
                <div className="p-3 border rounded-lg">
                  <p className="font-medium">{saleData.customer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {saleData.customer.condicion_iva || "Consumidor Final"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Consumidor Final</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo Documento</Label>
                  <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_DOCUMENTO.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Número Documento</Label>
                  <Input
                    value={numeroDocumento}
                    onChange={(e) => setNumeroDocumento(e.target.value)}
                    placeholder="Ej: 20123456789"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => emitirComprobante.mutate()}
            disabled={emitirComprobante.isPending || !isAFIPEnabled || !selectedPOSId}
          >
            {emitirComprobante.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Emitiendo...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Emitir Comprobante
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}