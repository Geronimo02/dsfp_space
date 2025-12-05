import * as React from "react";
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Search, Receipt, Eye, Printer, DollarSign, CreditCard } from "lucide-react";
import { ReceiptPDF } from "@/components/pos/ReceiptPDF";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import { usePermissions } from "@/hooks/usePermissions";

const customerSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(200, "El nombre debe tener máximo 200 caracteres"),
  email: z.string().trim().toLowerCase().max(255, "El email debe tener máximo 255 caracteres")
    .refine((val) => val === "" || z.string().email().safeParse(val).success, "Email inválido")
    .optional(),
  phone: z.string().max(20, "El teléfono debe tener máximo 20 caracteres").optional(),
  document: z.string().max(50, "El documento debe tener máximo 50 caracteres").optional(),
  address: z.string().max(500, "La dirección debe tener máximo 500 caracteres").optional(),
  credit_limit: z.number({ invalid_type_error: "El límite de crédito debe ser un número" })
    .nonnegative("El límite de crédito no puede ser negativo")
    .max(9999999999.99, "El límite de crédito es demasiado alto")
    .optional(),
  payment_terms: z.string().max(100, "Los términos de pago deben tener máximo 100 caracteres").optional(),
});

export default function Customers() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('customers', 'create');
  const canEdit = hasPermission('customers', 'edit');
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    address: "",
    credit_limit: "",
    payment_terms: "",
  });
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers", searchQuery],
    queryFn: async () => {
      let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
      
      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: customerSales } = useQuery({
    queryKey: ["customer-sales", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items(*)
        `)
        .eq("customer_id", selectedCustomer.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomer?.id,
  });

  const { data: customerPayments } = useQuery({
    queryKey: ["customer-payments", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      
      const { data, error } = await supabase
        .from("customer_payments")
        .select("*")
        .eq("customer_id", selectedCustomer.id)
        .order("payment_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomer?.id,
  });

  const { data: customerMovements } = useQuery({
    queryKey: ["customer-movements", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      
      try {
        // Usar query directa con casting de tipos
        const { data, error } = await (supabase as any)
          .rpc('get_customer_movements', { customer_id: selectedCustomer.id });
        
        if (error) {
          console.warn("Error fetching customer movements:", error);
          return [];
        }
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn("Error fetching customer movements:", error);
        return [];
      }
    },
    enabled: !!selectedCustomer?.id,
  });

  const { data: invoicePayments } = useQuery({
    queryKey: ["invoice-payments", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      
      try {
        // Usar query directa con casting de tipos
        const { data, error } = await (supabase as any)
          .rpc('get_invoice_payments', { customer_id: selectedCustomer.id });
        
        if (error) {
          console.warn("Error fetching invoice payments:", error);
          return [];
        }
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn("Error fetching invoice payments:", error);
        return [];
      }
    },
    enabled: !!selectedCustomer?.id,
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("customers").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear cliente");
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("customers").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsDialogOpen(false);
      setEditingCustomer(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar cliente");
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Crear el pago usando RPC con casting de tipos
      const { data: result, error } = await (supabase as any)
        .rpc('create_customer_payment', {
          p_customer_id: data.customer_id,
          p_amount: data.amount,
          p_payment_method: data.payment_method,
          p_notes: data.notes,
          p_user_id: user.id
        });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Pago registrado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["customer-movements"] });
      setIsPaymentDialogOpen(false);
      setPaymentData({ amount: "", payment_method: "cash", notes: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar pago");
    },
  });

  const applyPaymentToInvoiceMutation = useMutation({
    mutationFn: async ({ paymentId, saleId, amountApplied }: { 
      paymentId: string; 
      saleId: string; 
      amountApplied: number; 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Usar RPC con casting de tipos para aplicar pago a factura
      const { error } = await (supabase as any).rpc('apply_payment_to_invoice', {
        p_payment_id: paymentId,
        p_sale_id: saleId,
        p_customer_id: selectedCustomer.id,
        p_amount_applied: amountApplied,
        p_user_id: user.id
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pago aplicado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments"] });
      queryClient.invalidateQueries({ queryKey: ["customer-movements"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al aplicar pago");
    },
  });

  const checkCreditLimitMutation = useMutation({
    mutationFn: async ({ customerId, newAmount }: { customerId: string; newAmount: number }) => {
      const { data: customer, error } = await supabase
        .from("customers")
        .select("credit_limit, current_balance")
        .eq("id", customerId)
        .single();

      if (error) throw error;

      const projectedBalance = (customer.current_balance || 0) + newAmount;
      const creditLimit = customer.credit_limit || 0;

      if (projectedBalance > creditLimit) {
        throw new Error(`Cliente excede límite de crédito. Límite: $${creditLimit}, Proyectado: $${projectedBalance}`);
      }

      return { approved: true, remainingCredit: creditLimit - projectedBalance };
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      document: "",
      address: "",
      credit_limit: "",
      payment_terms: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = customerSchema.parse({
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        document: formData.document || undefined,
        address: formData.address || undefined,
        credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
        payment_terms: formData.payment_terms || undefined,
      });

      const customerData = {
        name: validatedData.name,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        document: validatedData.document || null,
        address: validatedData.address || null,
        credit_limit: validatedData.credit_limit ?? 0,
        payment_terms: validatedData.payment_terms || null,
      };

      if (editingCustomer) {
        updateCustomerMutation.mutate({ id: editingCustomer.id, data: customerData });
      } else {
        createCustomerMutation.mutate(customerData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Error al validar los datos del cliente");
      }
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    if (selectedCustomer.selectedSale) {
      // Es un pago específico a una factura - necesitamos crear el pago primero
      const paymentAmount = parseFloat(paymentData.amount);
      
      // Crear el pago general
      createPaymentMutation.mutate({
        customer_id: selectedCustomer.id,
        amount: paymentAmount,
        payment_method: paymentData.payment_method,
        notes: paymentData.notes || `Pago aplicado a factura ${selectedCustomer.selectedSale.sale_number}`,
      });

      // Después aplicarlo a la factura específica (esto se manejará en el onSuccess del createPaymentMutation)
      // Por ahora, el flujo es: crear pago -> aplicar a factura manualmente
    } else {
      // Es un pago general
      createPaymentMutation.mutate({
        customer_id: selectedCustomer.id,
        amount: parseFloat(paymentData.amount),
        payment_method: paymentData.payment_method,
        notes: paymentData.notes || null,
      });
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      document: customer.document || "",
      address: customer.address || "",
      credit_limit: customer.credit_limit?.toString() || "",
      payment_terms: customer.payment_terms || "",
    });
    setIsDialogOpen(true);
  };

  const handleViewHistory = (customer: any) => {
    setSelectedCustomer(customer);
    setIsHistoryOpen(true);
  };

  const totalSpent = customerSales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0;

  const handlePrintReceipt = (sale: any) => {
    const saleData = {
      ...sale,
      items: sale.sale_items || [],
      customer: selectedCustomer,
    };
    ReceiptPDF(saleData);
  };

  const paymentMethods = [
    { value: 'cash', label: 'Efectivo', icon: '💵' },
    { value: 'card', label: 'Tarjeta', icon: '💳' },
    { value: 'transfer', label: 'Transferencia', icon: '🏦' },
    { value: 'credit', label: 'Crédito', icon: '📝' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground">Gestiona tu base de clientes</p>
          </div>
          {canCreate && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingCustomer(null); resetForm(); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Cliente
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">Documento</Label>
                  <Input
                    id="document"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit_limit">Límite de Crédito</Label>
                  <Input
                    id="credit_limit"
                    type="number"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Condiciones de Pago</Label>
                  <Input
                    id="payment_terms"
                    placeholder="Ej: 30 días"
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingCustomer ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Puntos</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Límite</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers?.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.email || "-"}</TableCell>
                    <TableCell>{customer.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {customer.loyalty_points || 0} pts
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        customer.loyalty_tier === 'gold' ? 'default' : 
                        customer.loyalty_tier === 'silver' ? 'secondary' : 
                        'outline'
                      }>
                        {customer.loyalty_tier === 'gold' ? '🏆 Gold' : 
                         customer.loyalty_tier === 'silver' ? '🥈 Silver' : 
                         '🥉 Bronze'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={Number(customer.current_balance) > 0 ? "destructive" : "default"}>
                        ${Number(customer.current_balance || 0).toFixed(2)}
                      </Badge>
                    </TableCell>
                    <TableCell>${Number(customer.credit_limit || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {Number(customer.current_balance) > 0 && (
                        <Button 
                          size="icon" 
                          variant="outline"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsPaymentDialogOpen(true);
                          }}
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="outline" onClick={() => handleViewHistory(customer)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <Button size="icon" variant="outline" onClick={() => handleEdit(customer)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Cuenta Corriente - {selectedCustomer?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-6 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Puntos Fidelización</p>
                      <p className="text-2xl font-bold text-primary">
                        {selectedCustomer?.loyalty_points || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Nivel</p>
                      <p className="text-xl font-bold">
                        {selectedCustomer?.loyalty_tier === 'gold' ? '🏆 Gold' : 
                         selectedCustomer?.loyalty_tier === 'silver' ? '🥈 Silver' : 
                         '🥉 Bronze'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo Actual</p>
                      <p className={`text-2xl font-bold ${Number(selectedCustomer?.current_balance) > 0 ? 'text-destructive' : 'text-success'}`}>
                        ${Number(selectedCustomer?.current_balance || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Límite de Crédito</p>
                      <p className="text-2xl font-bold text-primary">
                        ${Number(selectedCustomer?.credit_limit || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Compras</p>
                      <p className="text-2xl font-bold">{customerSales?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Promedio</p>
                      <p className="text-2xl font-bold">
                        ${customerSales?.length ? (totalSpent / customerSales.length).toFixed(2) : "0.00"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="movements" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="movements">Cuenta Corriente</TabsTrigger>
                  <TabsTrigger value="sales">Ventas</TabsTrigger>
                  <TabsTrigger value="payments">Pagos</TabsTrigger>
                </TabsList>

                <TabsContent value="movements" className="mt-4">
                  <div className="space-y-4">
                    {/* Credit Limit Indicator */}
                    <Card className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Límite de Crédito Utilizado</span>
                          <span className="font-medium">
                            ${Number(selectedCustomer?.current_balance || 0).toFixed(2)} / 
                            ${Number(selectedCustomer?.credit_limit || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              (Number(selectedCustomer?.current_balance || 0) / Number(selectedCustomer?.credit_limit || 1)) > 0.8 
                                ? 'bg-destructive' 
                                : (Number(selectedCustomer?.current_balance || 0) / Number(selectedCustomer?.credit_limit || 1)) > 0.6 
                                ? 'bg-warning' 
                                : 'bg-success'
                            }`}
                            style={{ 
                              width: `${Math.min(100, (Number(selectedCustomer?.current_balance || 0) / Number(selectedCustomer?.credit_limit || 1)) * 100)}%` 
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Disponible: ${(Number(selectedCustomer?.credit_limit || 0) - Number(selectedCustomer?.current_balance || 0)).toFixed(2)}
                        </div>
                      </div>
                    </Card>

                    {/* Account Movements */}
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Comprobante</TableHead>
                            <TableHead>Concepto</TableHead>
                            <TableHead className="text-right">Debe</TableHead>
                            <TableHead className="text-right">Haber</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.isArray(customerMovements) && customerMovements.length > 0 ? (
                            customerMovements.map((movement: any, index: number) => (
                              <TableRow key={movement.id}>
                                <TableCell>
                                  {format(new Date(movement.movement_date), "dd/MM/yyyy", { locale: es })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={
                                    movement.movement_type === 'sale' ? 'border-red-500 text-red-700' :
                                    movement.movement_type === 'payment' ? 'border-green-500 text-green-700' :
                                    movement.movement_type === 'credit_note' ? 'border-blue-500 text-blue-700' :
                                    'border-gray-500 text-gray-700'
                                  }>
                                    {movement.movement_type === 'sale' ? 'Venta' :
                                     movement.movement_type === 'payment' ? 'Pago' :
                                     movement.movement_type === 'credit_note' ? 'Nota Crédito' :
                                     movement.movement_type === 'quotation' ? 'Presupuesto' :
                                     movement.movement_type === 'reservation' ? 'Reserva' : 'Otro'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono">
                                  {movement.reference_number || '-'}
                                </TableCell>
                                <TableCell>{movement.description}</TableCell>
                                <TableCell className="text-right font-medium text-red-600">
                                  {movement.debit_amount > 0 ? `$${movement.debit_amount.toFixed(2)}` : '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-600">
                                  {movement.credit_amount > 0 ? `$${movement.credit_amount.toFixed(2)}` : '-'}
                                </TableCell>
                                <TableCell className="text-right font-bold">
                                  ${movement.balance.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    movement.status === 'pending' ? 'destructive' :
                                    movement.status === 'paid' ? 'default' :
                                    movement.status === 'overdue' ? 'destructive' : 'secondary'
                                  }>
                                    {movement.status === 'pending' ? 'Pendiente' :
                                     movement.status === 'paid' ? 'Pagado' :
                                     movement.status === 'overdue' ? 'Vencido' :
                                     movement.status === 'partial' ? 'Parcial' : movement.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground">
                                {!customerMovements ? "Cargando movimientos..." : "No hay movimientos de cuenta corriente"}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sales" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Facturas Pendientes</h3>
                      <Button 
                        size="sm" 
                        onClick={() => {
                          // Generar estado de cuenta
                          window.open(`/customers/${selectedCustomer.id}/account-statement`, '_blank');
                        }}
                      >
                        Exportar Estado de Cuenta
                      </Button>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Vencimiento</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Pagado</TableHead>
                            <TableHead>Saldo</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerSales?.filter(sale => sale.payment_method === 'credit').map((sale) => {
                            const totalPaid = Array.isArray(invoicePayments) ? invoicePayments
                              .filter((ip: any) => ip.sale_id === sale.id)
                              .reduce((sum: number, ip: any) => sum + Number(ip.amount_applied), 0) : 0;
                            const balance = Number(sale.total) - totalPaid;
                            const isOverdue = new Date(sale.created_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            
                            return (
                              <TableRow key={sale.id}>
                                <TableCell className="font-medium">{sale.sale_number}</TableCell>
                                <TableCell>
                                  {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: es })}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "dd/MM/yyyy", { locale: es })}
                                </TableCell>
                                <TableCell className="font-bold">
                                  ${Number(sale.total).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-green-600 font-medium">
                                  ${totalPaid.toFixed(2)}
                                </TableCell>
                                <TableCell className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  ${balance.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    balance <= 0 ? 'default' :
                                    isOverdue ? 'destructive' :
                                    totalPaid > 0 ? 'secondary' : 'outline'
                                  }>
                                    {balance <= 0 ? 'Pagado' :
                                     isOverdue ? 'Vencido' :
                                     totalPaid > 0 ? 'Parcial' : 'Pendiente'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {balance > 0 && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedCustomer({...selectedCustomer, selectedSale: sale});
                                        setIsPaymentDialogOpen(true);
                                      }}
                                    >
                                      Aplicar Pago
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="payments" className="mt-4">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerPayments?.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {format(new Date(payment.payment_date), "dd/MM/yyyy HH:mm", { locale: es })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {payment.payment_method === "cash" ? "Efectivo" : 
                                 payment.payment_method === "card" ? "Tarjeta" : "Transferencia"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold text-success">
                              ${Number(payment.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {payment.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                {selectedCustomer?.selectedSale ? 
                  `Aplicar Pago a Factura ${selectedCustomer.selectedSale.sale_number}` :
                  `Registrar Pago - ${selectedCustomer?.name}`
                }
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              {selectedCustomer?.selectedSale && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Factura:</span>
                        <span className="font-medium">{selectedCustomer.selectedSale.sale_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Factura:</span>
                        <span className="font-bold">${Number(selectedCustomer.selectedSale.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ya Pagado:</span>
                        <span className="text-green-600">
                          ${(Array.isArray(invoicePayments) ? invoicePayments
                            .filter((ip: any) => ip.sale_id === selectedCustomer.selectedSale.id)
                            .reduce((sum: number, ip: any) => sum + Number(ip.amount_applied), 0) : 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Saldo Pendiente:</span>
                        <span className="text-red-600">
                          ${(Number(selectedCustomer.selectedSale.total) - 
                            (Array.isArray(invoicePayments) ? invoicePayments
                              .filter((ip: any) => ip.sale_id === selectedCustomer.selectedSale.id)
                              .reduce((sum: number, ip: any) => sum + Number(ip.amount_applied), 0) : 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {!selectedCustomer?.selectedSale && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Saldo Actual</p>
                      <p className="text-3xl font-bold text-destructive">
                        ${Number(selectedCustomer?.current_balance || 0).toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Monto del Pago *</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  required
                />
                {selectedCustomer?.selectedSale && (
                  <Button 
                    type="button" 
                    variant="link" 
                    size="sm"
                    onClick={() => {
                      const pendingAmount = Number(selectedCustomer.selectedSale.total) - 
                        (Array.isArray(invoicePayments) ? invoicePayments
                          .filter((ip: any) => ip.sale_id === selectedCustomer.selectedSale.id)
                          .reduce((sum: number, ip: any) => sum + Number(ip.amount_applied), 0) : 0);
                      setPaymentData({ ...paymentData, amount: pendingAmount.toString() });
                    }}
                  >
                    Aplicar saldo completo
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method">Método de Pago *</Label>
                <select
                  id="payment-method"
                  title="Seleccionar método de pago"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                >
                  {paymentMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.icon} {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-notes">Notas</Label>
                <Input
                  id="payment-notes"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  setIsPaymentDialogOpen(false);
                  if (selectedCustomer?.selectedSale) {
                    setSelectedCustomer({...selectedCustomer, selectedSale: null});
                  }
                }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedCustomer?.selectedSale ? 'Aplicar Pago' : 'Registrar Pago'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}