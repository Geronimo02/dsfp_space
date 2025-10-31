import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Package, AlertCircle, CheckCircle, XCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";

export default function BulkOperations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [operationType, setOperationType] = useState<string>("update_prices");
  const [entityType, setEntityType] = useState<string>("products");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"percentage" | "fixed">("percentage");

  const queryClient = useQueryClient();
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const canView = hasPermission("bulk_operations", "view");
  const canCreate = hasPermission("bulk_operations", "create");

  // Fetch bulk operations history
  const { data: operations, isLoading } = useQuery({
    queryKey: ["bulk-operations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulk_operations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: canView,
  });

  const executeBulkMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      let affectedRecords = 0;

      // Execute bulk operation based on type
      if (operationType === "update_prices" && entityType === "products") {
        const { data: products, error: fetchError } = await supabase
          .from("products")
          .select("id, price")
          .eq("active", true);

        if (fetchError) throw fetchError;

        const updates = products?.map(product => {
          const newPrice = adjustmentType === "percentage"
            ? Number(product.price) * (1 + parseFloat(adjustmentValue) / 100)
            : Number(product.price) + parseFloat(adjustmentValue);

          return supabase
            .from("products")
            .update({ price: newPrice })
            .eq("id", product.id);
        });

        if (updates) {
          await Promise.all(updates);
          affectedRecords = products?.length || 0;
        }
      } else if (operationType === "activate_products") {
        const { count, error } = await supabase
          .from("products")
          .update({ active: true })
          .eq("active", false);

        if (error) throw error;
        affectedRecords = count || 0;
      } else if (operationType === "deactivate_products") {
        const { count, error } = await supabase
          .from("products")
          .update({ active: false })
          .eq("active", true)
          .lte("stock", 0);

        if (error) throw error;
        affectedRecords = count || 0;
      }

      // Log the operation
      const { error: logError } = await supabase.from("bulk_operations").insert({
        operation_type: operationType,
        entity_type: entityType,
        records_affected: affectedRecords,
        operation_data: {
          adjustmentType,
          adjustmentValue,
        },
        status: "completed",
        user_id: user.id,
        completed_at: new Date().toISOString(),
      });

      if (logError) throw logError;

      return affectedRecords;
    },
    onSuccess: (affectedRecords) => {
      queryClient.invalidateQueries({ queryKey: ["bulk-operations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Operación completada. ${affectedRecords} registros afectados`);
      setDialogOpen(false);
      setAdjustmentValue("");
    },
    onError: (error) => {
      toast.error("Error al ejecutar operación: " + error.message);
    },
  });

  const handleExecute = () => {
    if (operationType === "update_prices" && !adjustmentValue) {
      toast.error("Por favor ingresa un valor de ajuste");
      return;
    }
    executeBulkMutation.mutate();
  };

  if (permissionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Cargando permisos...</p>
        </div>
      </Layout>
    );
  }

  if (!canView) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <AlertCircle className="h-16 w-16 text-warning" />
          <h2 className="text-2xl font-bold">Sin permisos</h2>
          <p className="text-muted-foreground">No tienes permisos para ver esta sección</p>
        </div>
      </Layout>
    );
  }

  const completedOps = operations?.filter(op => op.status === "completed").length || 0;
  const totalRecords = operations?.reduce((sum, op) => sum + op.records_affected, 0) || 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Operaciones Masivas</h1>
            <p className="text-muted-foreground">Ejecuta cambios en múltiples registros simultáneamente</p>
          </div>
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Zap className="mr-2 h-4 w-4" />
                  Nueva Operación
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ejecutar Operación Masiva</DialogTitle>
                  <DialogDescription>
                    Selecciona el tipo de operación y configura los parámetros
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="entity">Entidad</Label>
                    <Select value={entityType} onValueChange={setEntityType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="products">Productos</SelectItem>
                        <SelectItem value="customers">Clientes</SelectItem>
                        <SelectItem value="suppliers">Proveedores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="operation">Tipo de Operación</Label>
                    <Select value={operationType} onValueChange={setOperationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="update_prices">Actualizar Precios</SelectItem>
                        <SelectItem value="update_stock">Actualizar Stock</SelectItem>
                        <SelectItem value="activate_products">Activar Productos</SelectItem>
                        <SelectItem value="deactivate_products">Desactivar Productos sin Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {operationType === "update_prices" && (
                    <>
                      <div>
                        <Label htmlFor="adjustmentType">Tipo de Ajuste</Label>
                        <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as "percentage" | "fixed")}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                            <SelectItem value="fixed">Valor Fijo ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="value">Valor de Ajuste</Label>
                        <Input
                          id="value"
                          type="number"
                          step="0.01"
                          value={adjustmentValue}
                          onChange={(e) => setAdjustmentValue(e.target.value)}
                          placeholder={adjustmentType === "percentage" ? "Ej: 10 para +10%" : "Ej: 5 para +$5"}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {adjustmentType === "percentage" 
                            ? "Usa valores positivos para aumentar, negativos para reducir"
                            : "Usa valores positivos para aumentar, negativos para reducir"}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning">Advertencia</p>
                        <p className="text-muted-foreground">
                          Esta operación afectará múltiples registros. Asegúrate de revisar la configuración antes de ejecutar.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleExecute} disabled={executeBulkMutation.isPending}>
                      {executeBulkMutation.isPending ? "Ejecutando..." : "Ejecutar Operación"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Operaciones Completadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedOps}</div>
              <p className="text-xs text-muted-foreground">Ejecutadas exitosamente</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registros Afectados</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRecords}</div>
              <p className="text-xs text-muted-foreground">Total procesados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última Operación</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {operations && operations.length > 0 
                  ? format(new Date(operations[0].created_at), "dd/MM", { locale: es })
                  : "-"}
              </div>
              <p className="text-xs text-muted-foreground">Fecha</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Historial de Operaciones</CardTitle>
            <CardDescription>Registro de todas las operaciones masivas ejecutadas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando historial...</p>
            ) : operations && operations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>{format(new Date(op.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                      <TableCell className="capitalize">
                        {op.operation_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="capitalize">{op.entity_type}</TableCell>
                      <TableCell className="font-bold">{op.records_affected}</TableCell>
                      <TableCell>
                        <Badge variant={
                          op.status === "completed" ? "default" :
                          op.status === "failed" ? "destructive" : "secondary"
                        }>
                          <span className="flex items-center gap-1">
                            {op.status === "completed" ? <CheckCircle className="h-3 w-3" /> :
                             op.status === "failed" ? <XCircle className="h-3 w-3" /> : null}
                            {op.status === "completed" ? "Completado" :
                             op.status === "failed" ? "Fallido" : "Procesando"}
                          </span>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No hay operaciones registradas</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}