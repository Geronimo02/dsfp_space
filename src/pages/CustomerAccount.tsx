import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, DollarSign, TrendingDown, Clock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { useCompany } from "@/contexts/CompanyContext";

export default function CustomerAccount() {
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers-with-balance", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  const { data: customerDetails } = useQuery({
    queryKey: ["customer-account", selectedCustomer],
    queryFn: async () => {
      if (!selectedCustomer) return null;

      const [customer, sales, payments] = await Promise.all([
        supabase.from("customers").select("*").eq("id", selectedCustomer).single(),
        supabase
          .from("sales")
          .select("*")
          .eq("company_id", currentCompany?.id)
          .eq("customer_id", selectedCustomer)
          .order("created_at", { ascending: false }),
        supabase
          .from("customer_payments")
          .select("*")
          .eq("customer_id", selectedCustomer)
          .order("payment_date", { ascending: false }),
      ]);

      if (customer.error) throw customer.error;

      return {
        customer: customer.data,
        sales: sales.data || [],
        payments: payments.data || [],
      };
    },
    enabled: !!selectedCustomer,
  });

  const { data: customerMovements } = useQuery({
    queryKey: ["customer-movements", selectedCustomer],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      
      try {
        const { data, error } = await (supabase as any)
          .rpc('get_customer_movements', { customer_id: selectedCustomer });
        
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
    enabled: !!selectedCustomer,
  });

  const filteredCustomers = customers?.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.document?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-destructive";
    if (balance < 0) return "text-success";
    return "text-muted-foreground";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cuentas Corrientes</h1>
          <p className="text-muted-foreground">Gestión de saldos y pagos de clientes</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lista de clientes */}
          <Card className="shadow-soft lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Clientes</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredCustomers?.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedCustomer === customer.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted border-transparent"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.document || "Sin documento"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${getBalanceColor(Number(customer.current_balance))}`}>
                        ${Number(customer.current_balance).toFixed(2)}
                      </p>
                      {Number(customer.current_balance) > 0 && (
                        <Badge variant="destructive" className="text-xs mt-1">Debe</Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Detalle de cuenta */}
          <Card className="shadow-soft lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">
                {customerDetails?.customer ? (
                  <div className="flex items-center justify-between">
                    <span>Estado de Cuenta - {customerDetails.customer.name}</span>
                    <Badge 
                      variant={Number(customerDetails.customer.current_balance) > 0 ? "destructive" : "outline"}
                      className="text-lg px-4 py-1"
                    >
                      Saldo: ${Number(customerDetails.customer.current_balance).toFixed(2)}
                    </Badge>
                  </div>
                ) : (
                  "Selecciona un cliente"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!customerDetails ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un cliente para ver su estado de cuenta</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Información del cliente */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{customerDetails.customer.email || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      <p className="text-sm font-medium">{customerDetails.customer.phone || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Límite de Crédito</p>
                      <p className="text-sm font-medium">${Number(customerDetails.customer.credit_limit).toFixed(2)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Dirección</p>
                      <p className="text-sm font-medium">{customerDetails.customer.address || "-"}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Historial de movimientos */}
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Movimientos de Cuenta Corriente
                    </h3>
                    
                    <div className="max-h-[400px] overflow-y-auto">
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
                                  <Clock className="h-8 w-8 text-muted-foreground/50" />
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
