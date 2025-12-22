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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar as CalendarIcon, 
  Send, 
  Download, 
  Mail, 
  FileSpreadsheet, 
  FileText,
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Receipt,
  Loader2
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
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

  // Fetch all report data
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["accountant-reports", currentCompany?.id, monthStart, monthEnd],
    queryFn: async () => {
      const [
        salesResponse, 
        purchasesResponse, 
        afipResponse,
        expensesResponse,
        customersResponse,
        suppliersResponse
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(`
            *,
            sale_items(*, products(name, sku)),
            customers(name, document, tipo_documento, condicion_iva, numero_documento)
          `)
          .eq("company_id", currentCompany?.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString())
          .order("created_at"),
        supabase
          .from("purchases")
          .select(`
            *,
            purchase_items(*),
            suppliers(name, tax_id, condicion_iva)
          `)
          .eq("company_id", currentCompany?.id)
          .gte("created_at", monthStart.toISOString())
          .lte("created_at", monthEnd.toISOString())
          .order("created_at"),
        supabase
          .from("comprobantes_afip")
          .select("*")
          .eq("company_id", currentCompany?.id)
          .gte("fecha_emision", monthStart.toISOString())
          .lte("fecha_emision", monthEnd.toISOString())
          .order("fecha_emision"),
        supabase
          .from("expenses")
          .select("*, expense_categories(name)")
          .eq("company_id", currentCompany?.id)
          .gte("expense_date", monthStart.toISOString().split('T')[0])
          .lte("expense_date", monthEnd.toISOString().split('T')[0])
          .order("expense_date"),
        supabase
          .from("customers")
          .select("*")
          .eq("company_id", currentCompany?.id),
        supabase
          .from("suppliers")
          .select("*")
          .eq("company_id", currentCompany?.id),
      ]);

      const sales = salesResponse.data || [];
      const purchases = purchasesResponse.data || [];
      const afipInvoices = afipResponse.data || [];
      const expenses = expensesResponse.data || [];

      // Calculate totals
      const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
      const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      
      // Calculate IVA
      const ivaVentas = sales.reduce((sum, s) => sum + ((s.total || 0) - (s.subtotal || 0)), 0);
      const ivaCompras = purchases.reduce((sum, p) => sum + (p.tax || 0), 0);
      const ivaBalance = ivaVentas - ivaCompras;

      // Group by payment method
      const salesByPayment = sales.reduce((acc: Record<string, number>, s) => {
        acc[s.payment_method || 'other'] = (acc[s.payment_method || 'other'] || 0) + (s.total || 0);
        return acc;
      }, {});

      // Group expenses by category
      const expensesByCategory = expenses.reduce((acc: Record<string, number>, e: any) => {
        const cat = e.expense_categories?.name || 'Sin categoría';
        acc[cat] = (acc[cat] || 0) + (e.amount || 0);
        return acc;
      }, {});

      return {
        sales,
        purchases,
        afipInvoices,
        expenses,
        totals: {
          salesCount: sales.length,
          purchasesCount: purchases.length,
          afipCount: afipInvoices.length,
          expensesCount: expenses.length,
          totalSales,
          totalPurchases,
          totalExpenses,
          ivaVentas,
          ivaCompras,
          ivaBalance,
          netResult: totalSales - totalPurchases - totalExpenses,
        },
        salesByPayment,
        expensesByCategory,
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

  // Generate and download CSV file
  const downloadCSV = (filename: string, data: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate Libro IVA Ventas
  const generateLibroIVAVentas = () => {
    if (!reportData) return;
    
    const headers = [
      "Fecha Comprobante",
      "Tipo Comprobante",
      "Punto de Venta",
      "Número Comprobante",
      "Código Documento",
      "Número Documento",
      "Denominación Comprador",
      "Importe Operaciones Exentas",
      "Importe Percepciones IVA",
      "Importe Percepciones Otros",
      "Importe IVA 10.5%",
      "Importe IVA 21%",
      "Importe IVA 27%",
      "Importe Neto Gravado",
      "Importe Total"
    ];

    const rows = reportData.sales.map((sale: any) => {
      const afip = reportData.afipInvoices.find((a: any) => a.sale_id === sale.id);
      const iva = (sale.total || 0) - (sale.subtotal || 0);
      const tipoDoc = sale.customers?.tipo_documento === 'CUIT' ? '80' : '96';
      
      return [
        format(new Date(sale.created_at), "yyyyMMdd"),
        afip?.tipo_comprobante === 'FACTURA_A' ? '001' : afip?.tipo_comprobante === 'FACTURA_B' ? '006' : '011',
        String(afip?.punto_venta || 1).padStart(5, '0'),
        String(afip?.numero_comprobante || sale.sale_number).padStart(20, '0'),
        tipoDoc,
        (sale.customers?.numero_documento || sale.customers?.document || '0').replace(/\D/g, '').padStart(11, '0'),
        sale.customers?.name || 'Consumidor Final',
        '0.00',
        '0.00',
        '0.00',
        '0.00',
        iva.toFixed(2),
        '0.00',
        (sale.subtotal || 0).toFixed(2),
        (sale.total || 0).toFixed(2)
      ];
    });

    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    downloadCSV(`libro_iva_ventas_${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Libro IVA Ventas descargado");
  };

  // Generate Libro IVA Compras
  const generateLibroIVACompras = () => {
    if (!reportData) return;
    
    const headers = [
      "Fecha Comprobante",
      "Tipo Comprobante",
      "Punto de Venta",
      "Número Comprobante",
      "Código Documento",
      "CUIT Vendedor",
      "Denominación Vendedor",
      "Importe Operaciones Exentas",
      "Importe IVA 10.5%",
      "Importe IVA 21%",
      "Importe IVA 27%",
      "Importe Neto Gravado",
      "Importe Total"
    ];

    const rows = reportData.purchases.map((purchase: any) => {
      return [
        format(new Date(purchase.purchase_date || purchase.created_at), "yyyyMMdd"),
        '001', // Factura A por defecto
        '00001',
        String(purchase.purchase_number || '').padStart(20, '0'),
        '80', // CUIT
        (purchase.suppliers?.tax_id || '0').replace(/\D/g, '').padStart(11, '0'),
        purchase.suppliers?.name || '-',
        '0.00',
        '0.00',
        (purchase.tax || 0).toFixed(2),
        '0.00',
        (purchase.subtotal || 0).toFixed(2),
        (purchase.total || 0).toFixed(2)
      ];
    });

    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    downloadCSV(`libro_iva_compras_${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Libro IVA Compras descargado");
  };

  // Generate CITI Ventas (formato AFIP RG 3685)
  const generateCITIVentas = () => {
    if (!reportData) return;
    
    const rows = reportData.sales.map((sale: any) => {
      const afip = reportData.afipInvoices.find((a: any) => a.sale_id === sale.id);
      const tipoDoc = sale.customers?.tipo_documento === 'CUIT' ? '80' : '96';
      const cuit = (sale.customers?.numero_documento || sale.customers?.document || '0').replace(/\D/g, '');
      
      // Formato fijo según RG 3685
      return [
        format(new Date(sale.created_at), "yyyyMMdd"), // Fecha
        afip?.tipo_comprobante === 'FACTURA_A' ? '001' : '006', // Tipo comprobante
        String(afip?.punto_venta || 1).padStart(5, '0'), // Punto venta
        String(afip?.numero_comprobante || '0').padStart(20, '0'), // Número
        String(afip?.numero_comprobante || '0').padStart(20, '0'), // Número hasta
        tipoDoc.padStart(2, '0'), // Código doc
        cuit.padStart(20, '0'), // Número doc
        (sale.customers?.name || 'Consumidor Final').substring(0, 30).padEnd(30, ' '), // Denominación
        (sale.total || 0).toFixed(2).replace('.', '').padStart(15, '0'), // Importe total
        '0'.repeat(15), // No categorizado
        '0'.repeat(15), // Percepciones
        '0'.repeat(15), // Imp internos
        (sale.subtotal || 0).toFixed(2).replace('.', '').padStart(15, '0'), // Neto gravado
        '0005', // Alícuota IVA (21%)
        ((sale.total || 0) - (sale.subtotal || 0)).toFixed(2).replace('.', '').padStart(15, '0'), // Importe IVA
        '0'.repeat(15), // Operaciones exentas
        'PES', // Moneda
        '0001000000', // Tipo cambio
        '0', // Cantidad alícuotas
        'N', // Código operación
        '0'.repeat(15), // Otros tributos
        format(new Date(sale.created_at), "yyyyMMdd"), // Fecha vto pago
      ].join('');
    });

    const content = rows.join("\n");
    downloadCSV(`CITI_VENTAS_${format(selectedMonth, "yyyyMM")}.txt`, content);
    toast.success("Archivo CITI Ventas descargado");
  };

  // Generate CITI Compras
  const generateCITICompras = () => {
    if (!reportData) return;
    
    const rows = reportData.purchases.map((purchase: any) => {
      const cuit = (purchase.suppliers?.tax_id || '0').replace(/\D/g, '');
      
      return [
        format(new Date(purchase.purchase_date || purchase.created_at), "yyyyMMdd"),
        '001', // Factura A
        '00001',
        String(purchase.purchase_number || '0').padStart(20, '0'),
        String(purchase.purchase_number || '0').padStart(20, '0'),
        '80', // CUIT
        cuit.padStart(20, '0'),
        (purchase.suppliers?.name || '-').substring(0, 30).padEnd(30, ' '),
        (purchase.total || 0).toFixed(2).replace('.', '').padStart(15, '0'),
        '0'.repeat(15),
        (purchase.subtotal || 0).toFixed(2).replace('.', '').padStart(15, '0'),
        '0005',
        (purchase.tax || 0).toFixed(2).replace('.', '').padStart(15, '0'),
        '0'.repeat(15),
        'PES',
        '0001000000',
        '0',
        '0',
        '0'.repeat(11),
        'A'.padEnd(15, ' '),
      ].join('');
    });

    const content = rows.join("\n");
    downloadCSV(`CITI_COMPRAS_${format(selectedMonth, "yyyyMM")}.txt`, content);
    toast.success("Archivo CITI Compras descargado");
  };

  // Generate Resumen Mensual Excel-compatible
  const generateResumenMensual = () => {
    if (!reportData) return;
    
    const { totals, salesByPayment, expensesByCategory } = reportData;
    
    let content = "RESUMEN MENSUAL CONTABLE\n";
    content += `Período: ${format(selectedMonth, "MMMM yyyy", { locale: es })}\n`;
    content += `Empresa: ${currentCompany?.name}\n\n`;
    
    content += "=== VENTAS ===\n";
    content += `Cantidad de operaciones;${totals.salesCount}\n`;
    content += `Total Ventas;${totals.totalSales.toFixed(2)}\n`;
    content += `IVA Débito Fiscal;${totals.ivaVentas.toFixed(2)}\n\n`;
    
    content += "Por forma de pago:\n";
    Object.entries(salesByPayment).forEach(([method, amount]) => {
      content += `${method};${(amount as number).toFixed(2)}\n`;
    });
    
    content += "\n=== COMPRAS ===\n";
    content += `Cantidad de operaciones;${totals.purchasesCount}\n`;
    content += `Total Compras;${totals.totalPurchases.toFixed(2)}\n`;
    content += `IVA Crédito Fiscal;${totals.ivaCompras.toFixed(2)}\n\n`;
    
    content += "=== GASTOS ===\n";
    content += `Cantidad de gastos;${totals.expensesCount}\n`;
    content += `Total Gastos;${totals.totalExpenses.toFixed(2)}\n\n`;
    
    content += "Por categoría:\n";
    Object.entries(expensesByCategory).forEach(([cat, amount]) => {
      content += `${cat};${(amount as number).toFixed(2)}\n`;
    });
    
    content += "\n=== POSICIÓN IVA ===\n";
    content += `IVA Débito Fiscal;${totals.ivaVentas.toFixed(2)}\n`;
    content += `IVA Crédito Fiscal;${totals.ivaCompras.toFixed(2)}\n`;
    content += `Saldo IVA (${totals.ivaBalance >= 0 ? 'A Pagar' : 'A Favor'});${Math.abs(totals.ivaBalance).toFixed(2)}\n\n`;
    
    content += "=== RESULTADO ===\n";
    content += `Ingresos;${totals.totalSales.toFixed(2)}\n`;
    content += `Egresos;${(totals.totalPurchases + totals.totalExpenses).toFixed(2)}\n`;
    content += `Resultado Neto;${totals.netResult.toFixed(2)}\n`;

    downloadCSV(`resumen_mensual_${format(selectedMonth, "yyyy-MM")}.csv`, content);
    toast.success("Resumen mensual descargado");
  };

  // Download all reports as ZIP (simulated - downloads individually)
  const downloadAllReports = () => {
    generateLibroIVAVentas();
    setTimeout(() => generateLibroIVACompras(), 200);
    setTimeout(() => generateCITIVentas(), 400);
    setTimeout(() => generateCITICompras(), 600);
    setTimeout(() => generateResumenMensual(), 800);
  };

  const handleSendReports = () => {
    if (!recipientEmail) {
      toast.error("Ingrese el email del contador");
      return;
    }
    sendReportsMutation.mutate();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calculator className="h-8 w-8" />
              Reportes para Contador
            </h1>
            <p className="text-muted-foreground">
              Genera y exporta reportes contables en formatos compatibles con AFIP
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedMonth, "MMMM yyyy", { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => date && setSelectedMonth(date)}
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ventas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : formatCurrency(reportData?.totals.totalSales || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {reportData?.totals.salesCount || 0} operaciones
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Compras</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : formatCurrency(reportData?.totals.totalPurchases || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {reportData?.totals.purchasesCount || 0} operaciones
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">IVA Posición</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                (reportData?.totals.ivaBalance || 0) >= 0 ? "text-red-600" : "text-green-600"
              )}>
                {isLoading ? "..." : formatCurrency(Math.abs(reportData?.totals.ivaBalance || 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                {(reportData?.totals.ivaBalance || 0) >= 0 ? "A Pagar" : "A Favor"}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resultado</CardTitle>
              <Building2 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                (reportData?.totals.netResult || 0) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {isLoading ? "..." : formatCurrency(reportData?.totals.netResult || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Neto del período
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="downloads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="downloads">Descargas</TabsTrigger>
            <TabsTrigger value="preview">Vista Previa</TabsTrigger>
            <TabsTrigger value="email">Enviar por Email</TabsTrigger>
          </TabsList>

          <TabsContent value="downloads" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Libro IVA Ventas */}
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    Libro IVA Ventas
                  </CardTitle>
                  <CardDescription>
                    Formato compatible con aplicativos AFIP
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={generateLibroIVAVentas} 
                    className="w-full"
                    disabled={isLoading || !reportData}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar CSV
                  </Button>
                </CardContent>
              </Card>

              {/* Libro IVA Compras */}
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileSpreadsheet className="h-5 w-5 text-red-600" />
                    Libro IVA Compras
                  </CardTitle>
                  <CardDescription>
                    Formato compatible con aplicativos AFIP
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={generateLibroIVACompras} 
                    className="w-full"
                    disabled={isLoading || !reportData}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar CSV
                  </Button>
                </CardContent>
              </Card>

              {/* CITI Ventas */}
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Receipt className="h-5 w-5 text-blue-600" />
                    CITI Ventas
                  </CardTitle>
                  <CardDescription>
                    Formato RG 3685 para régimen informativo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={generateCITIVentas} 
                    className="w-full"
                    disabled={isLoading || !reportData}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar TXT
                  </Button>
                </CardContent>
              </Card>

              {/* CITI Compras */}
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Receipt className="h-5 w-5 text-orange-600" />
                    CITI Compras
                  </CardTitle>
                  <CardDescription>
                    Formato RG 3685 para régimen informativo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={generateCITICompras} 
                    className="w-full"
                    disabled={isLoading || !reportData}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar TXT
                  </Button>
                </CardContent>
              </Card>

              {/* Resumen Mensual */}
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-purple-600" />
                    Resumen Mensual
                  </CardTitle>
                  <CardDescription>
                    Resumen completo del período para análisis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={generateResumenMensual} 
                    className="w-full"
                    disabled={isLoading || !reportData}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar CSV
                  </Button>
                </CardContent>
              </Card>

              {/* Descargar Todo */}
              <Card className="hover:border-primary/50 transition-colors bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Download className="h-5 w-5" />
                    Todos los Reportes
                  </CardTitle>
                  <CardDescription>
                    Descarga todos los archivos de una vez
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={downloadAllReports} 
                    className="w-full"
                    variant="default"
                    disabled={isLoading || !reportData}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Todo
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vista Previa - Ventas del Período</CardTitle>
                <CardDescription>
                  Últimas {Math.min(reportData?.sales.length || 0, 10)} ventas de {reportData?.totals.salesCount || 0} totales
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Cond. IVA</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                        <TableHead className="text-right">IVA</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData?.sales.slice(0, 10).map((sale: any) => (
                        <TableRow key={sale.id}>
                          <TableCell>{format(new Date(sale.created_at), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="font-mono">{sale.sale_number}</TableCell>
                          <TableCell>{sale.customers?.name || "Consumidor Final"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {sale.customers?.condicion_iva || "CF"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(sale.subtotal || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency((sale.total || 0) - (sale.subtotal || 0))}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(sale.total || 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Enviar Reportes por Email
                </CardTitle>
                <CardDescription>
                  Envía todos los reportes del período directamente al contador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email del Contador *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="contador@estudio.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Contador</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Ej: Juan Pérez"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Se enviarán los siguientes archivos:
                  </p>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      libro_iva_ventas.csv
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      libro_iva_compras.csv
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      registro_ventas.csv
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-orange-500" />
                      registro_compras.csv
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-purple-500" />
                      resumen_mensual.csv
                    </li>
                  </ul>
                </div>

                <Button
                  onClick={handleSendReports}
                  disabled={sendReportsMutation.isPending || !recipientEmail}
                  className="w-full"
                >
                  {sendReportsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar Reportes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AccountantReports;