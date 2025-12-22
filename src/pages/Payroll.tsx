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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { DollarSign, Plus, FileText, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const Payroll = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const { data: liquidations, isLoading } = useQuery({
    queryKey: ["payroll_liquidations", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("payroll_liquidations")
        .select(`
          *,
          employees (first_name, last_name)
        `)
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      
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
          total_deductions: 0,
          net_salary: employee.base_salary,
          status: "draft",
          created_by: user.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_liquidations"] });
      toast.success("Liquidación creada exitosamente");
      setDialogOpen(false);
      setSelectedEmployee("");
      setSelectedMonth("");
      setSelectedYear("");
    },
    onError: (error: any) => {
      toast.error("Error al crear liquidación: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary",
      calculated: "default",
      approved: "default",
      paid: "default",
    } as const;

    const labels = {
      draft: "Borrador",
      calculated: "Calculado",
      approved: "Aprobado",
      paid: "Pagado",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Liquidaciones</h1>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Liquidación
            </Button>
          </div>
          <div className="animate-pulse bg-muted h-96 rounded-lg" />
        </div>
      </Layout>
    );
  }

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

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Módulo en Desarrollo</AlertTitle>
          <AlertDescription className="text-amber-600/80">
            Las funcionalidades avanzadas como cálculo automático de deducciones, aportes patronales, 
            generación de recibos de sueldo y exportación a formatos legales estarán disponibles próximamente.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Liquidaciones</h1>
              <Badge variant="secondary" className="mt-1 flex items-center gap-1 w-fit">
                <Clock className="h-3 w-3" />
                Versión Beta
              </Badge>
            </div>
          </div>
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
                  <Label htmlFor="employee">Empleado</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar empleado" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees?.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="month">Mes</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar mes" />
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
                  <Label htmlFor="year">Año</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar año" />
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

                <Button 
                  onClick={() => createMutation.mutate()} 
                  disabled={!selectedEmployee || !selectedMonth || !selectedYear || createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? "Creando..." : "Crear Liquidación"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Liquidaciones de Sueldo</CardTitle>
          <CardDescription>
            Gestión de liquidaciones mensuales de empleados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {liquidations && liquidations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Sueldo Base</TableHead>
                  <TableHead>Remunerativo</TableHead>
                  <TableHead>Deducciones</TableHead>
                  <TableHead>Sueldo Neto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidations.map((liquidation: any) => (
                  <TableRow key={liquidation.id}>
                    <TableCell>
                      {liquidation.employees?.first_name} {liquidation.employees?.last_name}
                    </TableCell>
                    <TableCell>
                      {liquidation.period_month}/{liquidation.period_year}
                    </TableCell>
                    <TableCell>${liquidation.base_salary.toLocaleString()}</TableCell>
                    <TableCell>${liquidation.total_remunerative.toLocaleString()}</TableCell>
                    <TableCell>${liquidation.total_deductions.toLocaleString()}</TableCell>
                    <TableCell className="font-semibold">
                      ${liquidation.net_salary.toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(liquidation.status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4" />
                      </Button>
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
                Comienza creando la primera liquidación mensual
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