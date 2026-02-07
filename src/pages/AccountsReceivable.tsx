import * as React from "react";
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Receipt, DollarSign, CreditCard, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";

export default function AccountsReceivable() {
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
  });
  const queryClient = useQueryClient();

  // Query para obtener clientes con saldo
  const { data: customers } = useQuery({
    queryKey: ["customers-with-balance", searchQuery, currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .gt("current_balance", 0)
        .limit(500)
        .order("current_balance", { ascending: false });
      
      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.ilike("name", `%${sanitized}%`);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Query para movimientos del cliente seleccionado
  const { data: customerMovements } = useQuery({
    queryKey: ["customer-movements", selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return [];
      
      try {
        const { data, error } = await (supabase as any)
          .rpc('get_customer_movements', { customer_id: selectedCustomer.id });
        
        if (error) {
          console.warn("Error fetching movements:", error);
          return [];
        }
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn("Error fetching movements:", error);
        return [];
      }
    },
    enabled: !!selectedCustomer?.id,
  });

  // Mutation para crear pagos
  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

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
      queryClient.invalidateQueries({ queryKey: ["customers-with-balance"] });
      queryClient.invalidateQueries({ queryKey: ["customer-movements"] });
      setIsPaymentDialogOpen(false);
      setPaymentData({ amount: "", payment_method: "cash", notes: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar pago");
    },
  });

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    createPaymentMutation.mutate({
      customer_id: selectedCustomer.id,
      amount: parseFloat(paymentData.amount),
      payment_method: paymentData.payment_method,
      notes: paymentData.notes || null,
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cuentas Corrientes</h1>
            <p className="text-muted-foreground">Gestiona las cuentas corrientes de los clientes</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Clientes */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clientes con Saldo
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customers?.map((customer) => (
                  <div
                    key={customer.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCustomer?.id === customer.id 
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedCustomer(customer)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive" className="text-xs">
                          ${Number(customer.current_balance || 0).toFixed(2)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                {customers?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No hay clientes con saldo pendiente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detalle del Cliente */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  {selectedCustomer ? `Movimientos - ${selectedCustomer.name}` : 'Selecciona un Cliente'}
                </div>
                {selectedCustomer && (
                  <Button 
                    size="sm" 
                    onClick={() => setIsPaymentDialogOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    Registrar Pago
                  </Button>
                )}
              </CardTitle>
              {selectedCustomer && (
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Saldo Actual</p>
                    <p className="text-2xl font-bold text-destructive">
                      ${Number(selectedCustomer.current_balance || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Límite de Crédito</p>
                    <p className="text-2xl font-bold text-primary">
                      ${Number(selectedCustomer.credit_limit || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Disponible</p>
                    <p className="text-2xl font-bold text-success">
                      ${(Number(selectedCustomer.credit_limit || 0) - Number(selectedCustomer.current_balance || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
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
                        customerMovements.map((movement: any) => (
                          <TableRow key={movement.id} className={
                            movement.movement_type === 'sale' && movement.status === 'pending' ? 'bg-red-50 hover:bg-red-100' :
                            movement.movement_type === 'sale' && movement.status === 'partial' ? 'bg-yellow-50 hover:bg-yellow-100' :
                            movement.movement_type === 'sale' && movement.status === 'paid' ? 'bg-green-50 hover:bg-green-100' :
                            movement.movement_type === 'payment' ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-muted/50'
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
                                'border-gray-500 text-gray-700'
                              }>
                                {movement.movement_type === 'sale' ? 
                                  (movement.status === 'paid' ? '✅ Venta Pagada' :
                                   movement.status === 'partial' ? '🟡 Venta Parcial' :
                                   '🔴 Venta Pendiente') :
                                 movement.movement_type === 'payment' ? '💰 Pago Recibido' :
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
                                <span className="text-xs ml-1">
                                  {movement.balance < 0 ? 'CR' : 'DB'}
                                </span>
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
                              <p>No hay movimientos registrados</p>
                              <p className="text-xs">Los movimientos aparecerán cuando se realicen ventas a crédito o pagos</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Selecciona un cliente</p>
                  <p className="text-sm">Elige un cliente de la lista para ver sus movimientos de cuenta corriente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dialog de Pago */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Registrar Pago - {selectedCustomer?.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
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
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Registrar Pago
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}