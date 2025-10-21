import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: sales } = useQuery({
    queryKey: ["sales", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          *,
          customer:customers(name)
        `)
        .order("created_at", { ascending: false });
      
      if (searchQuery) {
        query = query.or(`sale_number.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
    };
    return labels[method] || method;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ventas</h1>
          <p className="text-muted-foreground">Historial de transacciones</p>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número de venta..."
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
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Método de Pago</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      {sale.sale_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>{sale.customer?.name || "Cliente general"}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPaymentMethodLabel(sale.payment_method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      ${Number(sale.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-success">
                        {sale.status === "completed" ? "Completada" : sale.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
