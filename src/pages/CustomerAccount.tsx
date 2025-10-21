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

export default function CustomerAccount() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers-with-balance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
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
                      Historial de Movimientos
                    </h3>
                    
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {/* Combinar ventas y pagos */}
                      {[
                        ...customerDetails.sales.map(s => ({ ...s, type: 'sale' as const })),
                        ...customerDetails.payments.map(p => ({ ...p, type: 'payment' as const }))
                      ]
                        .sort((a, b) => {
                          const dateA = new Date(a.type === 'sale' ? a.created_at : (a as any).payment_date);
                          const dateB = new Date(b.type === 'sale' ? b.created_at : (b as any).payment_date);
                          return dateB.getTime() - dateA.getTime();
                        })
                        .map((item, index) => {
                          const isSale = item.type === 'sale';
                          const date = isSale ? item.created_at : (item as any).payment_date;
                          const amount = isSale ? item.total : (item as any).amount;
                          
                          return (
                            <div
                              key={`${item.type}-${item.id}`}
                              className={`p-3 rounded-lg border ${
                                isSale
                                  ? 'bg-destructive/5 border-destructive/20' 
                                  : 'bg-success/5 border-success/20'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  {isSale ? (
                                    <TrendingDown className="h-5 w-5 text-destructive mt-0.5" />
                                  ) : (
                                    <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                                  )}
                                  <div>
                                    <p className="font-medium text-sm">
                                      {isSale ? `Venta ${(item as any).sale_number}` : 'Pago Recibido'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es })}
                                    </p>
                                    {isSale && (item as any).payment_method === 'credit' && (
                                      <Badge variant="outline" className="mt-1 text-xs">A crédito</Badge>
                                    )}
                                    {!isSale && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Método: {(item as any).payment_method}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`text-lg font-bold ${
                                    isSale ? 'text-destructive' : 'text-success'
                                  }`}>
                                    {isSale ? '+' : '-'}${Number(amount).toFixed(2)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      
                      {customerDetails.sales.length === 0 && customerDetails.payments.length === 0 && (
                        <p className="text-center py-8 text-sm text-muted-foreground">
                          No hay movimientos registrados
                        </p>
                      )}
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
