import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { Layout } from "@/components/layout/Layout";

export default function Dashboard() {
  const { data: salesData } = useQuery({
    queryKey: ["sales-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("total, created_at")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const total = data?.reduce((acc, sale) => acc + Number(sale.total), 0) || 0;
      const today = data?.filter(sale => {
        const saleDate = new Date(sale.created_at);
        const todayDate = new Date();
        return saleDate.toDateString() === todayDate.toDateString();
      }).reduce((acc, sale) => acc + Number(sale.total), 0) || 0;
      
      return { total, today, count: data?.length || 0 };
    },
  });

  const { data: productsCount } = useQuery({
    queryKey: ["products-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: customersCount } = useQuery({
    queryKey: ["customers-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .lte("stock", 10);
      
      if (error) throw error;
      return count || 0;
    },
  });

  const stats = [
    {
      title: "Ventas de Hoy",
      value: `$${salesData?.today.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: "Ingresos del día actual",
      color: "text-primary",
    },
    {
      title: "Ventas Totales",
      value: salesData?.count || 0,
      icon: ShoppingCart,
      description: "Transacciones registradas",
      color: "text-accent",
    },
    {
      title: "Productos",
      value: productsCount || 0,
      icon: Package,
      description: `${lowStockProducts || 0} con stock bajo`,
      color: "text-success",
    },
    {
      title: "Clientes",
      value: customersCount || 0,
      icon: Users,
      description: "Clientes registrados",
      color: "text-blue-600",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Vista general del negocio</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="shadow-soft hover:shadow-medium transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Resumen de Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Acumulado</span>
                <span className="text-2xl font-bold text-primary">
                  ${salesData?.total.toFixed(2) || "0.00"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Promedio por Venta</span>
                <span className="text-lg font-semibold">
                  ${salesData?.count ? (salesData.total / salesData.count).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
