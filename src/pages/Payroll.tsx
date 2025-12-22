import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DollarSign, Plus, FileText, Calculator, Users, CheckCircle, Clock, Settings } from "lucide-react";
import { PayrollCalculator } from "@/components/payroll/PayrollCalculator";
import { PayrollReceiptPDF } from "@/components/payroll/PayrollReceiptPDF";

const Payroll = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorSalary, setCalculatorSalary] = useState<number>(0);

  const { data: liquidations, isLoading } = useQuery({
    queryKey: ["payroll_liquidations", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("payroll_liquidations")
        .select(`
          *,
          employees (first_name, last_name, document_number, position, hire_date)
        `)
        .eq("company_id", currentCompany.id)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: employees } = useQuery({
    queryKey: ["employees", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !selectedEmployee || !selectedMonth || !selectedYear) {
        throw new Error("Faltan datos requeridos");
      }

      const employee = employees?.find(e => e.id === selectedEmployee);
      if (!employee) throw new Error("Empleado no encontrado");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Calculate deductions (17% standard Argentina)
      const grossSalary = employee.base_salary;
      const totalDeductions = grossSalary * 0.17; // 11% jubilación + 3% obra social + 3% PAMI
      const netSalary = grossSalary - totalDeductions;

      const { error } = await supabase
        .from("payroll_liquidations")
        .insert({
          company_id: currentCompany.id,
          employee_id: selectedEmployee,
          period_month: parseInt(selectedMonth),
          period_year: parseInt(selectedYear),
          base_salary: employee.base_salary,
          total_remunerative: employee.base_salary,
          total_non_remunerative: 0,
          total_deductions: totalDeductions,
          net_salary: netSalary,
          status: "calculated",
          created_by: user.id,
          worked_days: 30,
          absent_days: 0,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_liquidations"] });
      toast.success("Liquidación creada y calculada exitosamente");
      setDialogOpen(false);
      setSelectedEmployee("");
      setSelectedMonth("");
      setSelectedYear("");
    },
    onError: (error: any) => {
      toast.error("Error al crear liquidación: " + error.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (liquidationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("payroll_liquidations")
        .update({ 
          status: "approved",
          approved_by: user?.id 
        })
        .eq("id", liquidationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_liquidations"] });
      toast.success("Liquidación aprobada");
    },
    onError: (error: any) => {
      toast.error("Error al aprobar: " + error.message);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (liquidationId: string) => {
      const { error } = await supabase
        .from("payroll_liquidations")
        .update({ 
          status: "paid",
          payment_date: new Date().toISOString().split('T')[0]
        })
        .eq("id", liquidationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_liquidations"] });
      toast.success("Liquidación marcada como pagada");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { variant: "secondary" as const, label: "Borrador", icon: Clock },
      calculated: { variant: "default" as const, label: "Calculado", icon: Calculator },
      approved: { variant: "outline" as const, label: "Aprobado", icon: CheckCircle },
      paid: { variant: "default" as const, label: "Pagado", icon: DollarSign },
      cancelled: { variant: "destructive" as const, label: "Cancelado", icon: Clock },
    };

    const { variant, label, icon: Icon } = config[status as keyof typeof config] || config.draft;

    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = [
    { value: "1", label: "Enero" },
    { value: "2", label: "Febrero" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Mayo" },
    { value: "6", label: "Junio" },
    { value: "7", label: "Julio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ];

  // Stats
  const totalPending = liquidations?.filter(l => l.status === "calculated").length || 0;
  const totalApproved = liquidations?.filter(l => l.status === "approved").length || 0;
  const totalPaid = liquidations?.filter(l => l.status === "paid").length || 0;
  const totalAmount = liquidations?.filter(l => l.status === "paid").reduce((sum, l) => sum + l.net_salary, 0) || 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded w-1/3" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8" />
              Liquidaciones de Sueldo
            </h1>
            <p className="text-muted-foreground">
              Gestión de recibos de sueldo y cargas sociales
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCalculator(!showCalculator)}>
              <Calculator className="mr-2 h-4 w-4" />
              Simulador
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Liquidación
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nueva Liquidación</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Empleado</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar empleado" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees?.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} - ${emp.base_salary?.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mes</Label>
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger>
                          <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger>
                          <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    onClick={() => createMutation.mutate()} 
                    disabled={!selectedEmployee || !selectedMonth || !selectedYear || createMutation.isPending}
                    className="w-full"
                  >
                    {createMutation.isPending ? "Calculando..." : "Crear y Calcular Liquidación"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Por Aprobar</p>
                  <p className="text-2xl font-bold">{totalPending}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aprobadas</p>
                  <p className="text-2xl font-bold">{totalApproved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pagadas</p>
                  <p className="text-2xl font-bold">{totalPaid}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pagado</p>
                  <p className="text-2xl font-bold">${totalAmount.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calculator */}
        {showCalculator && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Simulador de Liquidación
              </CardTitle>
              <CardDescription>
                Ingresá un sueldo bruto para ver el desglose de deducciones y cargas sociales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Sueldo Bruto</Label>
                <Input
                  type="number"
                  placeholder="Ingrese el sueldo bruto"
                  value={calculatorSalary || ""}
                  onChange={(e) => setCalculatorSalary(parseFloat(e.target.value) || 0)}
                  className="max-w-xs"
                />
              </div>
              {calculatorSalary > 0 && currentCompany && (
                <PayrollCalculator
                  companyId={currentCompany.id}
                  baseSalary={calculatorSalary}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Liquidations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Liquidaciones</CardTitle>
            <CardDescription>
              Todas las liquidaciones de sueldo generadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {liquidations && liquidations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Deducciones</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liquidations.map((liquidation: any) => (
                    <TableRow key={liquidation.id}>
                      <TableCell className="font-medium">
                        {liquidation.employees?.first_name} {liquidation.employees?.last_name}
                      </TableCell>
                      <TableCell>
                        {months.find(m => m.value === String(liquidation.period_month))?.label} {liquidation.period_year}
                      </TableCell>
                      <TableCell className="text-right">
                        ${liquidation.total_remunerative.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        -${liquidation.total_deductions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        ${liquidation.net_salary.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(liquidation.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {liquidation.status === "calculated" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => approveMutation.mutate(liquidation.id)}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {liquidation.status === "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markPaidMutation.mutate(liquidation.id)}
                              disabled={markPaidMutation.isPending}
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                          {currentCompany && (
                            <PayrollReceiptPDF
                              liquidation={liquidation}
                              company={{
                                name: currentCompany.name,
                                cuit: (currentCompany as any).cuit || undefined,
                                address: (currentCompany as any).address || undefined,
                              }}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay liquidaciones</h3>
                <p className="text-muted-foreground mb-4">
                  Creá la primera liquidación mensual para comenzar
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Primera Liquidación
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Payroll;