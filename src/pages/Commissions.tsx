import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Percent, DollarSign, Plus, Pencil, Trash2, Users, User, TrendingUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface Commission {
  id: string;
  name: string;
  description: string | null;
  type: 'percentage' | 'fixed';
  value: number;
  applies_to: 'seller' | 'customer' | 'product' | 'category';
  reference_id: string | null;
  active: boolean;
  min_amount: number | null;
  max_amount: number | null;
}

interface CommissionTransaction {
  id: string;
  commission_id: string | null;
  sale_id: string;
  user_id: string;
  customer_id: string | null;
  commission_type: string;
  commission_value: number;
  sale_amount: number;
  commission_amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export default function Commissions() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "percentage" as "percentage" | "fixed",
    value: 0,
    applies_to: "seller" as "seller" | "customer" | "product" | "category",
    reference_id: "",
    active: true,
    min_amount: "",
    max_amount: "",
  });

  // Query para obtener comisiones
  const { data: commissions = [] } = useQuery({
    queryKey: ["commissions", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("commissions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Commission[];
    },
    enabled: !!currentCompany?.id,
  });

  // Query para obtener transacciones de comisiones
  const { data: transactions = [] } = useQuery({
    queryKey: ["commission-transactions", currentCompany?.id, selectedSeller, statusFilter],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      let query = supabase
        .from("commission_transactions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });

      if (selectedSeller !== "all") {
        query = query.eq("user_id", selectedSeller);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CommissionTransaction[];
    },
    enabled: !!currentCompany?.id,
  });

  // Query para obtener empleados (vendedores)
  const { data: employees = [] } = useQuery({
    queryKey: ["employees", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Get company users
      const { data: companyUsers, error: cuError } = await supabase
        .from("company_users")
        .select("user_id")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      
      if (cuError) throw cuError;
      if (!companyUsers || companyUsers.length === 0) return [];

      // Get profiles for these users
      const userIds = companyUsers.map(cu => cu.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Combine data
      return companyUsers.map(cu => {
        const profile = profiles?.find(p => p.id === cu.user_id);
        return {
          user_id: cu.user_id,
          profiles: profile ? { full_name: profile.full_name } : null
        };
      });
    },
    enabled: !!currentCompany?.id,
  });

  // Query para obtener clientes
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", currentCompany.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const createCommissionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!currentCompany?.id) throw new Error("No hay empresa seleccionada");

      const { error } = await supabase.from("commissions").insert({
        company_id: currentCompany.id,
        name: data.name,
        description: data.description || null,
        type: data.type,
        value: data.value,
        applies_to: data.applies_to,
        reference_id: data.reference_id || null,
        active: data.active,
        min_amount: data.min_amount ? parseFloat(data.min_amount) : null,
        max_amount: data.max_amount ? parseFloat(data.max_amount) : null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comisión creada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear comisión");
    },
  });

  const updateCommissionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("commissions")
        .update({
          name: data.name,
          description: data.description || null,
          type: data.type,
          value: data.value,
          applies_to: data.applies_to,
          reference_id: data.reference_id || null,
          active: data.active,
          min_amount: data.min_amount ? parseFloat(data.min_amount) : null,
          max_amount: data.max_amount ? parseFloat(data.max_amount) : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comisión actualizada");
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      setIsDialogOpen(false);
      setEditingCommission(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar");
    },
  });

  const deleteCommissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comisión eliminada");
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar");
    },
  });

  const updateTransactionStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("commission_transactions")
        .update({
          status,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["commission-transactions"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar estado");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "percentage",
      value: 0,
      applies_to: "seller",
      reference_id: "",
      active: true,
      min_amount: "",
      max_amount: "",
    });
  };

  const handleEdit = (commission: Commission) => {
    setEditingCommission(commission);
    setFormData({
      name: commission.name,
      description: commission.description || "",
      type: commission.type,
      value: commission.value,
      applies_to: commission.applies_to,
      reference_id: commission.reference_id || "",
      active: commission.active,
      min_amount: commission.min_amount?.toString() || "",
      max_amount: commission.max_amount?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCommission) {
      updateCommissionMutation.mutate({ id: editingCommission.id, data: formData });
    } else {
      createCommissionMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      paid: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  // Calcular totales por vendedor
  const sellerStats = employees.map((emp) => {
    const empTransactions = transactions.filter((t) => t.user_id === emp.user_id);
    const total = empTransactions.reduce((sum, t) => sum + t.commission_amount, 0);
    const pending = empTransactions.filter((t) => t.status === "pending").reduce((sum, t) => sum + t.commission_amount, 0);
    const paid = empTransactions.filter((t) => t.status === "paid").reduce((sum, t) => sum + t.commission_amount, 0);

    return {
      user_id: emp.user_id,
      name: emp.profiles?.full_name || "Sin nombre",
      total,
      pending,
      paid,
      count: empTransactions.length,
    };
  });

  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">No hay empresa seleccionada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comisiones</h1>
          <p className="text-muted-foreground">Gestiona comisiones de vendedores y clientes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Comisión
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingCommission ? "Editar" : "Nueva"} Comisión</DialogTitle>
                <DialogDescription>Configure una nueva regla de comisión</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo *</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            Porcentaje
                          </div>
                        </SelectItem>
                        <SelectItem value="fixed">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Monto Fijo
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor *</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">{formData.type === "percentage" ? "%" : "$"}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_amount">Mínimo</Label>
                    <Input
                      id="min_amount"
                      type="number"
                      step="0.01"
                      value={formData.min_amount}
                      onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_amount">Máximo</Label>
                    <Input
                      id="max_amount"
                      type="number"
                      step="0.01"
                      value={formData.max_amount}
                      onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="applies_to">Aplica a *</Label>
                    <Select
                      value={formData.applies_to}
                      onValueChange={(value: any) => setFormData({ ...formData, applies_to: value, reference_id: "" })}
                    >
                      <SelectTrigger id="applies_to">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seller">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Vendedor
                          </div>
                        </SelectItem>
                        <SelectItem value="customer">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Cliente
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reference_id">
                      {formData.applies_to === "seller" ? "Vendedor" : "Cliente"} *
                    </Label>
                    <Select value={formData.reference_id} onValueChange={(value) => setFormData({ ...formData, reference_id: value })}>
                      <SelectTrigger id="reference_id">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.applies_to === "seller"
                          ? employees.map((emp) => (
                              <SelectItem key={emp.user_id} value={emp.user_id}>
                                {emp.profiles?.full_name || "Sin nombre"}
                              </SelectItem>
                            ))
                          : customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Activa</Label>
                  <Switch id="active" checked={formData.active} onCheckedChange={(checked) => setFormData({ ...formData, active: checked })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createCommissionMutation.isPending || updateCommissionMutation.isPending}>
                  {editingCommission ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reglas de Comisión</CardTitle>
              <CardDescription>Configura las reglas de cálculo de comisiones</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Aplica a</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No hay comisiones configuradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    commissions.map((commission) => (
                      <TableRow key={commission.id}>
                        <TableCell className="font-medium">{commission.name}</TableCell>
                        <TableCell>
                          {commission.type === "percentage" ? (
                            <Badge variant="outline">
                              <Percent className="h-3 w-3 mr-1" />%
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <DollarSign className="h-3 w-3 mr-1" />$
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {commission.value}
                          {commission.type === "percentage" ? "%" : ""}
                        </TableCell>
                        <TableCell className="capitalize">{commission.applies_to === "seller" ? "Vendedor" : "Cliente"}</TableCell>
                        <TableCell>
                          <Badge variant={commission.active ? "default" : "secondary"}>{commission.active ? "Activa" : "Inactiva"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(commission)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm("¿Eliminar esta comisión?")) {
                                  deleteCommissionMutation.mutate(commission.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comisiones por Vendedor</CardTitle>
              <CardDescription>Resumen de comisiones devengadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sellerStats.map((seller) => (
                  <Card key={seller.user_id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{seller.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total</span>
                        <span className="font-bold text-lg">${seller.total.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pendiente</span>
                        <span className="text-yellow-600">${seller.pending.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pagado</span>
                        <span className="text-green-600">${seller.paid.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Transacciones</span>
                        <Badge variant="outline">{seller.count}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transacciones de Comisiones</CardTitle>
                  <CardDescription>Historial detallado de comisiones</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.user_id} value={emp.user_id}>
                          {emp.profiles?.full_name || "Sin nombre"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="paid">Pagado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Venta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Monto Venta</TableHead>
                    <TableHead>Comisión</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No hay transacciones
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-sm">{transaction.sale_id.slice(0, 8)}</TableCell>
                        <TableCell className="capitalize">{transaction.commission_type === "percentage" ? "%" : "$"}</TableCell>
                        <TableCell>${transaction.sale_amount.toFixed(2)}</TableCell>
                        <TableCell className="font-bold">${transaction.commission_amount.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                        <TableCell>
                          {transaction.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTransactionStatusMutation.mutate({ id: transaction.id, status: "paid" })}
                            >
                              Marcar Pagada
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
