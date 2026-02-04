import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, TrendingUp, FileText, AlertCircle, CheckCircle2, Info, Wallet, CreditCard, Banknote, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";

export default function Expenses() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    category_id: "",
    description: "",
    amount: "",
    expense_date: format(new Date(), "yyyy-MM-dd"),
    payment_method: "cash",
    reference_number: "",
    supplier_id: "",
    notes: "",
    status: "pending",
  });

  const queryClient = useQueryClient();
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const canView = hasPermission("expenses", "view");
  const canCreate = hasPermission("expenses", "create");
  const canEdit = hasPermission("expenses", "edit");
  const canDelete = hasPermission("expenses", "delete");

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: canView,
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-list", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", currentCompany?.id)
        .eq("active", true)
        .limit(200)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: canView && !!currentCompany?.id,
  });

  // Fetch expenses
  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(`
          *,
          expense_categories(name, color),
          suppliers(name)
        `)
        .eq("company_id", currentCompany?.id)
        .limit(500)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: canView && !!currentCompany?.id,
  });

  // Stats
  const totalExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;
  const pendingExpenses = expenses?.filter(exp => exp.status === "pending").length || 0;
  const monthExpenses = expenses?.filter(exp => {
    const expDate = new Date(exp.expense_date);
    const now = new Date();
    return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
  }).reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

  const createExpenseMutation = useMutation({
    mutationFn: async (values: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Generate expense number
      const { data: expenseNumber, error: fnError } = await supabase.rpc("generate_expense_number");
      if (fnError) throw fnError;

      const { error } = await supabase.from("expenses").insert({
        ...values,
        expense_number: expenseNumber,
        amount: parseFloat(values.amount),
        user_id: user.id,
        category_id: values.category_id || null,
        supplier_id: values.supplier_id || null,
        company_id: currentCompany?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto registrado correctamente");
      setDialogOpen(false);
      setFormData({
        category_id: "",
        description: "",
        amount: "",
        expense_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: "cash",
        reference_number: "",
        supplier_id: "",
        notes: "",
        status: "pending",
      });
    },
    onError: (error) => {
      toast.error("Error al registrar gasto: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }
    createExpenseMutation.mutate(formData);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Gastos</h1>
            <p className="text-muted-foreground">Control y seguimiento de gastos operativos</p>
          </div>
            <Button variant="outline" onClick={() => navigate("/reports")}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Ver Reportes
            </Button>
            {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo Gasto
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Registrar nuevo gasto</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Registrar Nuevo Gasto
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Información básica */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Info className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold">Información Básica</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="description">Descripción *</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="expense_date">Fecha</Label>
                        <Input
                          id="expense_date"
                          type="date"
                          value={formData.expense_date}
                          onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="amount">Monto *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Categoría y Proveedor */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <FileText className="h-4 w-4 text-green-600 dark:text-green-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Categoría y Proveedor</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category">Categoría</Label>
                        <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="supplier">Proveedor</Label>
                        <Select value={formData.supplier_id} onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Opcional" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers?.map((sup) => (
                              <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Pago y Referencia */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-2 bg-amber-500/10 rounded-lg">
                        <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Pago y Referencia</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="payment_method">Método de Pago</Label>
                        <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona método" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="card">Tarjeta</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                            <SelectItem value="check">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="reference_number">Nº Referencia</Label>
                        <Input
                          id="reference_number"
                          value={formData.reference_number}
                          onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                          placeholder="Opcional"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Notas</h3>
                    </div>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      placeholder="Notas internas..."
                    />
                  </div>

                  {/* Resumen */}
                  <div className="bg-muted/30 border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Resumen</h3>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span>Monto:</span>
                      <span className="text-red-600 dark:text-red-400">${Number(formData.amount || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createExpenseMutation.isPending} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {createExpenseMutation.isPending ? "Guardando..." : "Guardar Gasto"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalExpenses.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Acumulado total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gastos del Mes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${monthExpenses.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Mes actual</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingExpenses}</div>
              <p className="text-xs text-muted-foreground">Por aprobar</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando gastos...</p>
            ) : expenses && expenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Gasto</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Método Pago</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.expense_number}</TableCell>
                      <TableCell>{format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell>
                        {expense.expense_categories && (
                          <Badge style={{ backgroundColor: expense.expense_categories.color }} className="text-white">
                            {expense.expense_categories.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>{expense.suppliers?.name || "-"}</TableCell>
                      <TableCell className="capitalize">
                        <Badge className={
                          expense.payment_method === "cash" ? "bg-green-500" :
                          expense.payment_method === "card" ? "bg-blue-600" :
                          expense.payment_method === "transfer" ? "bg-purple-600" :
                          "bg-amber-600"
                        }>
                          {expense.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-red-600 dark:text-red-400">${Number(expense.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={
                          expense.status === "approved" ? "bg-green-600" :
                          expense.status === "rejected" ? "bg-red-600" : "bg-yellow-500"
                        }>
                          {expense.status === "approved" ? "Aprobado" :
                           expense.status === "rejected" ? "Rechazado" : "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Placeholder para futuras acciones: ver/editar/eliminar */}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No hay gastos registrados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}