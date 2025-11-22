import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { DollarSign, Plus, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const Payroll = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

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
    );
  }

  return (
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
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Crear Primera Liquidación
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payroll;