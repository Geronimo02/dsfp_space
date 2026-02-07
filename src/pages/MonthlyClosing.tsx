import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Calendar as CalendarIcon, Download, FileText, ShoppingCart, Receipt, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Step = {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  component: React.ComponentType;
};

const MonthlyClosing = () => {
  const { currentCompany } = useCompany();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [currentStep, setCurrentStep] = useState(1);

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Fetch monthly data
  const { data: salesData } = useQuery({
    queryKey: ["monthly-sales", currentCompany?.id, monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*)")
        .eq("company_id", currentCompany?.id)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .limit(1000);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: purchasesData } = useQuery({
    queryKey: ["monthly-purchases", currentCompany?.id, monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, purchase_items(*)")
        .eq("company_id", currentCompany?.id)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .limit(1000);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: expensesData } = useQuery({
    queryKey: ["monthly-expenses", currentCompany?.id, monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .limit(1000);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: cashMovementsData } = useQuery({
    queryKey: ["monthly-cash", currentCompany?.id, monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .limit(1000);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const downloadCSV = (filename: string, data: string) => {
    const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const downloadIVASales = () => {
    if (!salesData) return;
    
    const csv = [
      ["Fecha", "Número", "Cliente", "Subtotal", "IVA", "Total"].join(","),
      ...salesData.map(sale => [
        format(new Date(sale.created_at), "dd/MM/yyyy"),
        sale.sale_number,
        sale.customer_id,
        sale.subtotal.toFixed(2),
        (sale.tax || 0).toFixed(2),
        sale.total.toFixed(2)
      ].join(","))
    ].join("\n");
    
    downloadCSV(`libro-iva-ventas-${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Libro IVA Ventas descargado");
  };

  const downloadIVAPurchases = () => {
    if (!purchasesData) return;
    
    const csv = [
      ["Fecha", "Número", "Proveedor", "Subtotal", "IVA", "Total"].join(","),
      ...purchasesData.map(purchase => [
        format(new Date(purchase.created_at), "dd/MM/yyyy"),
        purchase.purchase_number,
        purchase.supplier_id,
        purchase.subtotal.toFixed(2),
        (purchase.tax || 0).toFixed(2),
        purchase.total.toFixed(2)
      ].join(","))
    ].join("\n");
    
    downloadCSV(`libro-iva-compras-${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Libro IVA Compras descargado");
  };

  const downloadMonthlySummary = () => {
    const csv = [
      ["Concepto", "Cantidad", "Monto"].join(","),
      ["Ventas", salesData?.length || 0, totalSales.toFixed(2)].join(","),
      ["Compras", purchasesData?.length || 0, totalPurchases.toFixed(2)].join(","),
      ["IVA Débito Fiscal", "", salesTax.toFixed(2)].join(","),
      ["IVA Crédito Fiscal", "", purchasesTax.toFixed(2)].join(","),
      ["IVA a Pagar", "", (salesTax - purchasesTax).toFixed(2)].join(",")
    ].join("\n");
    
    downloadCSV(`resumen-mensual-${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Resumen mensual descargado");
  };

  const downloadSalesDetail = () => {
    if (!salesData) return;
    
    const csv = [
      ["Fecha", "Número", "Cliente", "Items", "Subtotal", "IVA", "Total", "Método Pago"].join(","),
      ...salesData.map(sale => [
        format(new Date(sale.created_at), "dd/MM/yyyy"),
        sale.sale_number,
        sale.customer_id,
        sale.sale_items?.length || 0,
        sale.subtotal.toFixed(2),
        (sale.tax || 0).toFixed(2),
        sale.total.toFixed(2),
        sale.payment_method
      ].join(","))
    ].join("\n");
    
    downloadCSV(`detalle-ventas-${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Detalle de ventas descargado");
  };

  const downloadPurchasesDetail = () => {
    if (!purchasesData) return;
    
    const csv = [
      ["Fecha", "Número", "Proveedor", "Items", "Subtotal", "IVA", "Total"].join(","),
      ...purchasesData.map(purchase => [
        format(new Date(purchase.created_at), "dd/MM/yyyy"),
        purchase.purchase_number,
        purchase.supplier_id,
        purchase.purchase_items?.length || 0,
        purchase.subtotal.toFixed(2),
        (purchase.tax || 0).toFixed(2),
        purchase.total.toFixed(2)
      ].join(","))
    ].join("\n");
    
    downloadCSV(`detalle-compras-${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Detalle de compras descargado");
  };

  const downloadCashMovements = () => {
    if (!cashMovementsData) return;
    
    const csv = [
      ["Fecha", "Tipo", "Categoría", "Descripción", "Monto"].join(","),
      ...cashMovementsData.map(movement => [
        format(new Date(movement.created_at), "dd/MM/yyyy"),
        movement.type,
        movement.category,
        movement.description || "",
        movement.amount.toFixed(2)
      ].join(","))
    ].join("\n");
    
    downloadCSV(`movimientos-caja-${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Movimientos de caja descargados");
  };

  const downloadExpenses = () => {
    if (!expensesData) return;
    
    const csv = [
      ["Fecha", "Número", "Descripción", "Categoría", "Monto", "Método Pago"].join(","),
      ...expensesData.map(expense => [
        format(new Date(expense.created_at), "dd/MM/yyyy"),
        expense.expense_number,
        expense.description,
        expense.category_id || "",
        expense.amount.toFixed(2),
        expense.payment_method
      ].join(","))
    ].join("\n");
    
    downloadCSV(`gastos-${format(selectedMonth, "yyyy-MM")}.csv`, csv);
    toast.success("Gastos descargados");
  };

  const toggleStep = (stepId: number) => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const totalSales = salesData?.reduce((sum, sale) => sum + sale.total, 0) || 0;
  const totalPurchases = purchasesData?.reduce((sum, purchase) => sum + purchase.total, 0) || 0;
  const salesTax = salesData?.reduce((sum, sale) => sum + (sale.tax || 0), 0) || 0;
  const purchasesTax = purchasesData?.reduce((sum, purchase) => sum + (purchase.tax || 0), 0) || 0;

  const SalesReviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Revisar Ventas del Mes
        </CardTitle>
        <CardDescription>
          Verificar todas las ventas registradas en {format(selectedMonth, "MMMM yyyy", { locale: es })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Total Ventas</div>
            <div className="text-2xl font-bold">{salesData?.length || 0}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Monto Total</div>
            <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">IVA Ventas</div>
            <div className="text-2xl font-bold">${salesTax.toFixed(2)}</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => window.open('/sales', '_blank')}>
            <FileText className="h-4 w-4 mr-2" />
            Ver Ventas Completas
          </Button>
          <Button
            onClick={() => toggleStep(1)}
            variant={completedSteps.has(1) ? "secondary" : "default"}
          >
            {completedSteps.has(1) ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Completado
              </>
            ) : (
              "Marcar como Revisado"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const PurchasesReviewStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Revisar Compras del Mes
        </CardTitle>
        <CardDescription>
          Verificar todas las compras registradas en {format(selectedMonth, "MMMM yyyy", { locale: es })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Total Compras</div>
            <div className="text-2xl font-bold">{purchasesData?.length || 0}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Monto Total</div>
            <div className="text-2xl font-bold">${totalPurchases.toFixed(2)}</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">IVA Compras</div>
            <div className="text-2xl font-bold">${purchasesTax.toFixed(2)}</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => window.open('/purchases', '_blank')}>
            <FileText className="h-4 w-4 mr-2" />
            Ver Compras Completas
          </Button>
          <Button
            onClick={() => toggleStep(2)}
            variant={completedSteps.has(2) ? "secondary" : "default"}
          >
            {completedSteps.has(2) ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Completado
              </>
            ) : (
              "Marcar como Revisado"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const IVABooksStep = () => {
    const netIVA = salesTax - purchasesTax;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Libros de IVA
          </CardTitle>
          <CardDescription>
            Resumen de IVA del período {format(selectedMonth, "MMMM yyyy", { locale: es })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
              <div className="text-sm text-muted-foreground">IVA Débito Fiscal (Ventas)</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                ${salesTax.toFixed(2)}
              </div>
            </div>
            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
              <div className="text-sm text-muted-foreground">IVA Crédito Fiscal (Compras)</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                ${purchasesTax.toFixed(2)}
              </div>
            </div>
          </div>

          <Separator />

          <div className="p-4 border-2 rounded-lg bg-primary/5">
            <div className="text-sm text-muted-foreground">IVA a Pagar / (Saldo a Favor)</div>
            <div className={cn("text-3xl font-bold", netIVA >= 0 ? "text-red-600" : "text-green-600")}>
              ${Math.abs(netIVA).toFixed(2)}
              {netIVA < 0 && " (Saldo a favor)"}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={downloadIVASales}>
              <Download className="h-4 w-4 mr-2" />
              Descargar Libro IVA Ventas
            </Button>
            <Button variant="outline" onClick={downloadIVAPurchases}>
              <Download className="h-4 w-4 mr-2" />
              Descargar Libro IVA Compras
            </Button>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => toggleStep(3)}
              variant={completedSteps.has(3) ? "secondary" : "default"}
            >
              {completedSteps.has(3) ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Completado
                </>
              ) : (
                "Marcar como Generado"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const ReportsStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Reportes para Contador
        </CardTitle>
        <CardDescription>
          Descarga todos los reportes necesarios para el cierre contable
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={downloadMonthlySummary}>
            <Download className="h-4 w-4 mr-2" />
            Resumen Mensual Completo
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={downloadSalesDetail}>
            <Download className="h-4 w-4 mr-2" />
            Detalle de Ventas
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={downloadPurchasesDetail}>
            <Download className="h-4 w-4 mr-2" />
            Detalle de Compras
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={downloadCashMovements}>
            <Download className="h-4 w-4 mr-2" />
            Movimientos de Caja
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={downloadSalesDetail}>
            <Download className="h-4 w-4 mr-2" />
            Cuentas Corrientes Clientes
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={downloadExpenses}>
            <Download className="h-4 w-4 mr-2" />
            Gastos del Período
          </Button>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={() => toggleStep(4)}
            variant={completedSteps.has(4) ? "secondary" : "default"}
          >
            {completedSteps.has(4) ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Completado
              </>
            ) : (
              "Marcar como Descargado"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const steps: Step[] = [
    {
      id: 1,
      title: "Revisar Ventas",
      description: "Verificar ventas del período",
      icon: Receipt,
      component: SalesReviewStep,
    },
    {
      id: 2,
      title: "Revisar Compras",
      description: "Verificar compras del período",
      icon: ShoppingCart,
      component: PurchasesReviewStep,
    },
    {
      id: 3,
      title: "Libros de IVA",
      description: "Generar libros de IVA",
      icon: FileText,
      component: IVABooksStep,
    },
    {
      id: 4,
      title: "Reportes Contador",
      description: "Descargar reportes",
      icon: Download,
      component: ReportsStep,
    },
  ];

  const progress = (completedSteps.size / steps.length) * 100;
  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Cierre Mensual</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Proceso de cierre contable
            </p>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Progreso del Cierre</CardTitle>
                <CardDescription>
                  {completedSteps.size} de {steps.length} pasos completados
                </CardDescription>
              </div>
              {completedSteps.size === steps.length && (
                <Badge className="bg-green-500">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Cierre Completo
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.has(step.id);
            const isCurrent = currentStep === step.id;

            return (
              <Card
                key={step.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  isCurrent && "border-primary shadow-md",
                  isCompleted && "bg-green-50 dark:bg-green-950 border-green-500"
                )}
                onClick={() => setCurrentStep(step.id)}
              >
                <CardHeader className="p-3 md:p-6">
                  <div className="flex items-start justify-between">
                    <Icon className={cn("h-6 w-6 md:h-8 md:w-8", isCompleted ? "text-green-600" : "text-muted-foreground")} />
                    {isCompleted && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <Check className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm md:text-base">{step.title}</CardTitle>
                  <CardDescription className="text-xs hidden sm:block">{step.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        <CurrentStepComponent />

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            Anterior
          </Button>
          <Button
            onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
            disabled={currentStep === steps.length}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default MonthlyClosing;
