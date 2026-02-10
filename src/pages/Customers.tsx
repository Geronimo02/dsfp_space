import * as React from "react";
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Search, Receipt, Eye, Printer, DollarSign, CreditCard, AlertCircle, CheckCircle2, Info, Wallet, TrendingUp, TrendingDown, FileText, Truck, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReceiptPDF } from "@/components/pos/ReceiptPDF";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";

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
  price_list_id: z.string().uuid().optional().nullable(),
});

export default function Customers() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
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
    price_list_id: "",
  });
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers", searchQuery, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = supabase.from("customers").select("*").eq("company_id", currentCompany.id).order("created_at", { ascending: false });
      
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
    enabled: !!currentCompany?.id,
  });

  const { data: priceLists } = useQuery({
    queryKey: ["price-lists", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: customerSales } = useQuery({
    queryKey: ["customer-sales", selectedCustomer?.id, currentCompany?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items(*)
        `)
        .eq("company_id", currentCompany?.id)
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

  // Nueva query para obtener TODOS los movimientos del cliente (incluyendo ventas no a crédito)
  const { data: allCustomerTransactions } = useQuery({
    queryKey: ["all-customer-transactions", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      
      try {
        // Obtener todas las ventas del cliente
        const { data: sales, error: salesError } = await supabase
          .from("sales")
          .select("*")
          .eq("customer_id", selectedCustomer.id)
          .order("created_at", { ascending: false });

        if (salesError) throw salesError;

        // Obtener todos los pagos del cliente
        const { data: payments, error: paymentsError } = await supabase
          .from("customer_payments")
          .select("*")
          .eq("customer_id", selectedCustomer.id)
          .order("payment_date", { ascending: false });

        if (paymentsError) throw paymentsError;

        // Combinar y formatear los datos
        const allTransactions = [];

        // Agregar ventas
        sales?.forEach(sale => {
          allTransactions.push({
            id: `sale-${sale.id}`,
            date: sale.created_at,
            type: sale.payment_method === 'credit' ? 'credit_sale' : 'cash_sale',
            reference: sale.sale_number,
            description: `Venta (${sale.payment_method === 'cash' ? 'Efectivo' : 
                                  sale.payment_method === 'card' ? 'Tarjeta' : 
                                  sale.payment_method === 'transfer' ? 'Transferencia' : 'Crédito'})`,
            amount: sale.total,
            status: sale.payment_method === 'credit' ? 'pending' : 'completed'
          });
        });

        // Agregar pagos
        payments?.forEach(payment => {
          allTransactions.push({
            id: `payment-${payment.id}`,
            date: payment.payment_date,
            type: 'payment',
            reference: `PAG-${payment.id.slice(-6)}`,
            description: `Pago recibido (${payment.payment_method === 'cash' ? 'Efectivo' : 
                                           payment.payment_method === 'card' ? 'Tarjeta' : 'Transferencia'})`,
            amount: payment.amount,
            status: 'completed',
            notes: payment.notes
          });
        });

        // Ordenar por fecha descendente
        return allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      } catch (error) {
        console.warn("Error fetching all customer transactions:", error);
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
      price_list_id: "",
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
        price_list_id: (!formData.price_list_id || formData.price_list_id === 'default') ? null : formData.price_list_id,
      });

      const customerData = {
        name: validatedData.name,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        document: validatedData.document || null,
        address: validatedData.address || null,
        credit_limit: validatedData.credit_limit ?? 0,
        payment_terms: validatedData.payment_terms || null,
  price_list_id: validatedData.price_list_id || null,
        company_id: currentCompany?.id,
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
      price_list_id: customer.price_list_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleViewHistory = (customer: any) => {
    setSelectedCustomer(customer);
    setIsHistoryOpen(true);
  };

  const getLoyaltyTierBadge = (tier: string | null) => {
    if (tier === 'gold') {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> Gold
        </Badge>
      );
    }
    if (tier === 'silver') {
      return (
        <Badge className="bg-gray-400 hover:bg-gray-500 text-white flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> Silver
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-700/80 hover:bg-amber-800 text-white flex items-center gap-1">
        <TrendingUp className="h-3 w-3" /> Bronze
      </Badge>
    );
  };

  const getBalanceBadge = (balance: number) => {
    if (balance > 0) {
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> ${balance.toFixed(2)}
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> ${balance.toFixed(2)}
      </Badge>
    );
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Gestiona tu base de clientes</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => navigate("/reports?tab=customers")} className="w-full sm:w-auto">
              <BarChart3 className="h-4 w-4 mr-2" />
              Ver Reportes
            </Button>
            {canCreate && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button onClick={() => { setEditingCustomer(null); resetForm(); }} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo Cliente
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Crear un nuevo cliente</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Sección Información Básica */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Info className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold">Información Básica</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre *</Label>
                        <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="document">Documento</Label>
                        <Input id="document" value={formData.document} onChange={(e) => setFormData({ ...formData, document: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  {/* Sección Dirección y Condiciones */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <DollarSign className="h-4 w-4 text-green-600 dark:text-green-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Dirección y Condiciones</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="address">Dirección</Label>
                        <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment_terms">Condiciones de Pago</Label>
                        <Input id="payment_terms" placeholder="Ej: 30 días" value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price_list_id">Lista de Precios</Label>
                        <Select value={formData.price_list_id} onValueChange={(value) => setFormData({ ...formData, price_list_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Usar precio por defecto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Predeterminada</SelectItem>
                            {priceLists?.map((list: any) => (
                              <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Si no se asigna, se usará la lista por defecto</p>
                      </div>
                    </div>
                  </div>

                  {/* Sección Crédito */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                      </div>
                      <h3 className="text-sm font-semibold">Crédito</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="credit_limit">Límite de Crédito</Label>
                        <Input id="credit_limit" type="number" step="0.01" value={formData.credit_limit} onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        {getBalanceBadge(Number(formData.credit_limit || 0) ? 0 : 0)}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" className="gap-2">
                      {editingCustomer ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" /> Actualizar
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" /> Crear Cliente
                        </>
                      )}
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
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 font-medium">
                        {customer.loyalty_points || 0} pts
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getLoyaltyTierBadge(customer.loyalty_tier)}
                    </TableCell>
                    <TableCell>
                      {getBalanceBadge(Number(customer.current_balance || 0))}
                    </TableCell>
                    <TableCell>${Number(customer.credit_limit || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  navigate(`/quotations?customer=${customer.id}`); 
                                }}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Nuevo presupuesto</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {Number(customer.current_balance) > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost"
                                  onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); setIsPaymentDialogOpen(true); }}
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Registrar pago</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleViewHistory(customer); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver cuenta corriente</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {canEdit && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar cliente</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
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
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Cuenta Corriente - {selectedCustomer?.name}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setIsHistoryOpen(false);
                      navigate(`/delivery-notes?customer=${selectedCustomer?.id}`);
                    }}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Ver entregas pendientes
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setIsHistoryOpen(false);
                      navigate(`/quotations?customer=${selectedCustomer?.id}`);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Nuevo presupuesto
                  </Button>
                </div>
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

              <Tabs defaultValue="all-transactions" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all-transactions">Todos los Movimientos</TabsTrigger>
                  <TabsTrigger value="movements">Cuenta Corriente</TabsTrigger>
                  <TabsTrigger value="sales">Ventas</TabsTrigger>
                  <TabsTrigger value="payments">Pagos</TabsTrigger>
                </TabsList>

                <TabsContent value="all-transactions" className="mt-4">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Historial Completo de Transacciones</h3>
                    
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Comprobante</TableHead>
                            <TableHead>Concepto</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Notas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.isArray(allCustomerTransactions) && allCustomerTransactions.length > 0 ? (
                            allCustomerTransactions.map((transaction: any) => (
                              <TableRow key={transaction.id}>
                                <TableCell>
                                  {format(new Date(transaction.date), "dd/MM/yyyy HH:mm", { locale: es })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={
                                    transaction.type === 'credit_sale' ? 'border-orange-500 text-orange-700' :
                                    transaction.type === 'cash_sale' ? 'border-blue-500 text-blue-700' :
                                    transaction.type === 'payment' ? 'border-green-500 text-green-700' :
                                    'border-gray-500 text-gray-700'
                                  }>
                                    {transaction.type === 'credit_sale' ? '📝 Venta a Crédito' :
                                     transaction.type === 'cash_sale' ? '💵 Venta al Contado' :
                                     transaction.type === 'payment' ? '💰 Pago' : 'Otro'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono">
                                  {transaction.reference}
                                </TableCell>
                                <TableCell>{transaction.description}</TableCell>
                                <TableCell className={`text-right font-medium ${
                                  transaction.type === 'payment' ? 'text-green-600' : 
                                  transaction.type === 'credit_sale' ? 'text-orange-600' : 'text-blue-600'
                                }`}>
                                  {transaction.type === 'payment' ? '+' : ''}${Number(transaction.amount).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    transaction.status === 'completed' ? 'default' :
                                    transaction.status === 'pending' ? 'destructive' : 'secondary'
                                  }>
                                    {transaction.status === 'completed' ? 'Completado' :
                                     transaction.status === 'pending' ? 'Pendiente' : transaction.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {transaction.notes || '-'}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No hay transacciones registradas
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </TabsContent>

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

                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Movimientos de Cuenta Corriente</h3>
                      <div className="text-sm text-muted-foreground">
                        Solo se muestran las operaciones que afectan el saldo del cliente
                      </div>
                    </div>

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
                              <TableRow key={movement.id} className={
                                movement.movement_type === 'sale' && movement.status === 'pending' ? 'bg-red-50' :
                                movement.movement_type === 'sale' && movement.status === 'partial' ? 'bg-yellow-50' :
                                movement.movement_type === 'sale' && movement.status === 'paid' ? 'bg-green-50' :
                                movement.movement_type === 'payment' ? 'bg-blue-50' : ''
                              }>
                                <TableCell>
                                  {format(new Date(movement.movement_date), "dd/MM/yyyy HH:mm", { locale: es })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={
                                    movement.movement_type === 'sale' && movement.status === 'paid' ? 'border-green-500 text-green-700 bg-green-50' :
                                    movement.movement_type === 'sale' && movement.status === 'partial' ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
                                    movement.movement_type === 'sale' && movement.status === 'pending' ? 'border-red-500 text-red-700 bg-red-50' :
                                    movement.movement_type === 'payment' ? 'border-green-500 text-green-700 bg-green-50' :
                                    movement.movement_type === 'credit_note' ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                    'border-gray-500 text-gray-700'
                                  }>
                                    {movement.movement_type === 'sale' ? 
                                      (movement.status === 'paid' ? '✅ Venta Pagada' :
                                       movement.status === 'partial' ? '🟡 Venta Parcial' :
                                       '🔴 Venta Pendiente') :
                                     movement.movement_type === 'payment' ? '💰 Pago Recibido' :
                                     movement.movement_type === 'credit_note' ? '📄 Nota Crédito' :
                                     'Otro'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {movement.reference_number || '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {movement.description}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {movement.debit_amount > 0 ? (
                                    <span className="text-red-600 font-bold">
                                      ${movement.debit_amount.toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {movement.credit_amount > 0 ? (
                                    <span className="text-green-600 font-bold">
                                      ${movement.credit_amount.toFixed(2)}
                                    </span>
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-bold text-lg">
                                  <span className={movement.balance >= 0 ? 'text-red-600' : 'text-green-600'}>
                                    ${Math.abs(movement.balance).toFixed(2)}
                                    {movement.balance < 0 ? ' CR' : ' DB'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    movement.status === 'paid' ? 'default' :
                                    movement.status === 'partial' ? 'secondary' :
                                    movement.status === 'pending' ? 'destructive' :
                                    movement.status === 'overdue' ? 'destructive' : 'outline'
                                  }>
                                    {movement.status === 'pending' ? '⏳ Pendiente' :
                                     movement.status === 'paid' ? '✅ Pagado' :
                                     movement.status === 'overdue' ? '🔴 Vencido' :
                                     movement.status === 'partial' ? '🟡 Parcial' : movement.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                <div className="flex flex-col items-center space-y-2">
                                  <Receipt className="h-8 w-8 text-muted-foreground/50" />
                                  <p>No hay movimientos de cuenta corriente</p>
                                  <p className="text-xs">Los movimientos aparecerán cuando se realicen ventas a crédito o pagos</p>
                                </div>
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
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <h3 className="text-lg font-semibold">Facturas Pendientes</h3>
                      <Button 
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
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
                            const totalPaid = 0; // Simplificado por ahora
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
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="transfer">Transferencia</option>
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
