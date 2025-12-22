import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Send, Download, Mail, Clock, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AccountantReports = () => {
  const { currentCompany } = useCompany();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Fetch monthly summary data
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ["accountant-summary", currentCompany?.id, monthStart, monthEnd],
    queryFn: async () => {
      const [salesResponse, purchasesResponse, afipResponse] = await Promise.all([
        supabase
          .from("sales")
          .select("*", { count: "exact" })
          .eq("company_id", currentCompany?.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString()),
        supabase
          .from("purchases")
          .select("*", { count: "exact" })
          .eq("company_id", currentCompany?.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString()),
        supabase
          .from("comprobantes_afip")
          .select("*", { count: "exact" })
          .eq("company_id", currentCompany?.id)
          .gte("fecha_emision", monthStart.toISOString())
          .lte("fecha_emision", monthEnd.toISOString()),
      ]);

      const totalSales = salesResponse.data?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
      const totalPurchases = purchasesResponse.data?.reduce((sum, p) => sum + (p.total || 0), 0) || 0;

      return {
        salesCount: salesResponse.count || 0,
        purchasesCount: purchasesResponse.count || 0,
        afipCount: afipResponse.count || 0,
        totalSales,
        totalPurchases,
      };
    },
    enabled: !!currentCompany?.id,
  });

  const sendReportsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-monthly-reports", {
        body: {
          companyId: currentCompany?.id,
          month: format(selectedMonth, "yyyy-MM"),
          recipientEmail,
          recipientName,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Reportes enviados exitosamente al contador");
      setRecipientEmail("");
      setRecipientName("");
    },
    onError: (error: any) => {
      toast.error(`Error al enviar reportes: ${error.message}`);
    },
  });

  const handleSendReports = () => {
    if (!recipientEmail) {
      toast.error("Ingrese el email del contador");
      return;
    }
    sendReportsMutation.mutate();
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Reportes para Contador
              <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Beta
              </Badge>
            </h1>
            <p className="text-muted-foreground">
              Envíe reportes contables mensuales automáticamente a su contador
            </p>
          </div>
        </div>

        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Funcionalidades Próximas</AlertTitle>
          <AlertDescription className="text-amber-600/80">
            Próximamente: programación de envío automático mensual, formatos CITI Ventas/Compras AFIP, 
            integración con sistemas contables y generación de archivos F.2002.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuración de envío */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Configuración de Envío
              </CardTitle>
              <CardDescription>
                Configure los detalles para el envío automático de reportes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Período</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedMonth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedMonth ? (
                        format(selectedMonth, "MMMM yyyy", { locale: es })
                      ) : (
                        <span>Seleccione mes</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(date) => date && setSelectedMonth(date)}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email del Contador</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contador@estudio.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Contador (opcional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>

              <Button
                onClick={handleSendReports}
                disabled={sendReportsMutation.isPending || !recipientEmail}
                className="w-full"
              >
                <Send className="mr-2 h-4 w-4" />
                {sendReportsMutation.isPending ? "Enviando..." : "Enviar Reportes"}
              </Button>
            </CardContent>
          </Card>

          {/* Resumen del período */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Período</CardTitle>
              <CardDescription>
                {format(selectedMonth, "MMMM yyyy", { locale: es })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Cargando datos...</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Ventas</span>
                    <div className="text-right">
                      <p className="font-bold">{summaryData?.salesCount || 0} operaciones</p>
                      <p className="text-sm text-muted-foreground">
                        ${summaryData?.totalSales?.toFixed(2) || "0.00"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Compras</span>
                    <div className="text-right">
                      <p className="font-bold">{summaryData?.purchasesCount || 0} operaciones</p>
                      <p className="text-sm text-muted-foreground">
                        ${summaryData?.totalPurchases?.toFixed(2) || "0.00"}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium">Comprobantes AFIP</span>
                    <p className="font-bold">{summaryData?.afipCount || 0}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Información de archivos incluidos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Archivos Incluidos en el Envío
            </CardTitle>
            <CardDescription>
              Los siguientes archivos CSV serán enviados al contador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <strong>libro_iva_ventas.csv</strong> - Libro IVA Ventas (formato AFIP)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <strong>libro_iva_compras.csv</strong> - Libro IVA Compras (formato AFIP)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <strong>registro_ventas.csv</strong> - Detalle completo de ventas
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <strong>registro_compras.csv</strong> - Detalle completo de compras
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <strong>resumen_mensual.csv</strong> - Resumen del período con IVA
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AccountantReports;
