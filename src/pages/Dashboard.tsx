import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp, Users, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

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

  // Ventas de últimos 7 días
  const { data: salesChart } = useQuery({
    queryKey: ["sales-chart"],
    queryFn: async () => {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        return startOfDay(date);
      });

      const { data, error } = await supabase
        .from("sales")
        .select("total, created_at")
        .gte("created_at", last7Days[0].toISOString());

      if (error) throw error;

      return last7Days.map(date => {
        const dayTotal = data
          ?.filter(sale => {
            const saleDate = startOfDay(new Date(sale.created_at));
            return saleDate.getTime() === date.getTime();
          })
          .reduce((acc, sale) => acc + Number(sale.total), 0) || 0;

        return {
          date: format(date, "dd/MM", { locale: es }),
          ventas: dayTotal,
        };
      });
    },
  });

  // Top 5 productos más vendidos
  const { data: topProducts } = useQuery({
    queryKey: ["top-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("product_name, quantity");

      if (error) throw error;

      const productMap = new Map<string, number>();
      data?.forEach(item => {
        const current = productMap.get(item.product_name) || 0;
        productMap.set(item.product_name, current + item.quantity);
      });

      return Array.from(productMap.entries())
        .map(([name, quantity]) => ({ producto: name, vendidos: quantity }))
        .sort((a, b) => b.vendidos - a.vendidos)
        .slice(0, 5);
    },
  });

  // Productos con stock crítico
  const { data: criticalStock } = useQuery({
    queryKey: ["critical-stock-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("name, stock, min_stock")
        .lte("stock", 10)
        .order("stock", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  const stats = [
    {
      title: "Ventas de Hoy",
      value: `$${salesData?.today.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: "Ingresos del día actual",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Ventas Totales",
      value: salesData?.count || 0,
      icon: ShoppingCart,
      description: "Transacciones registradas",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Productos",
      value: productsCount || 0,
      icon: Package,
      description: `${lowStockProducts || 0} con stock bajo`,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Clientes",
      value: customersCount || 0,
      icon: Users,
      description: "Clientes registrados",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
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
            <Card key={stat.title} className="shadow-soft hover:shadow-medium transition-all overflow-hidden">
              <div className={`h-1 w-full ${stat.bgColor}`} />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-2">
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

        {/* Ventas últimos 7 días */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Ventas de los Últimos 7 Días
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-sm" />
                <YAxis className="text-sm" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ventas']}
                />
                <Line 
                  type="monotone" 
                  dataKey="ventas" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top productos */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-success" />
                Top 5 Productos Más Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-sm" />
                  <YAxis dataKey="producto" type="category" width={100} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [value, 'Unidades']}
                  />
                  <Bar 
                    dataKey="vendidos" 
                    fill="hsl(var(--success))" 
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Alertas de stock */}
          <Card className="shadow-soft border-l-4 border-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Alertas de Stock Bajo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {criticalStock?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    ✅ No hay productos con stock crítico
                  </p>
                ) : (
                  criticalStock?.map((product, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock mínimo: {product.min_stock}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-warning">{product.stock}</p>
                        <p className="text-xs text-muted-foreground">unidades</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
