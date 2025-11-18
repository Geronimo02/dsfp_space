import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp, Users, AlertTriangle, BarChart3, Activity, ArrowUpRight } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { currentCompany } = useCompany();
  const { hasPermission, loading } = usePermissions();
  const canViewSales = hasPermission("sales", "view");
  const canViewProducts = hasPermission("products", "view");
  const canViewCustomers = hasPermission("customers", "view");

  const { data: salesData } = useQuery({
    queryKey: ["sales-stats", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("total, created_at")
        .eq("company_id", currentCompany?.id)
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
    enabled: canViewSales && !!currentCompany?.id,
  });

  const { data: productsCount } = useQuery({
    queryKey: ["products-count", currentCompany?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("company_id", currentCompany?.id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: canViewProducts && !!currentCompany?.id,
  });

  const { data: customersCount } = useQuery({
    queryKey: ["customers-count", currentCompany?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .eq("company_id", currentCompany?.id);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: canViewCustomers && !!currentCompany?.id,
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["low-stock", currentCompany?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("company_id", currentCompany?.id)
        .lte("stock", 10);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: canViewProducts && !!currentCompany?.id,
  });

  // Ventas de últimos 7 días
  const { data: salesChart } = useQuery({
    queryKey: ["sales-chart", currentCompany?.id],
    queryFn: async () => {
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        return startOfDay(date);
      });

      const { data, error } = await supabase
        .from("sales")
        .select("total, created_at")
        .eq("company_id", currentCompany?.id)
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
    enabled: canViewSales && !!currentCompany?.id,
  });

  // Top 5 productos más vendidos
  const { data: topProducts } = useQuery({
    queryKey: ["top-products", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("product_name, quantity, sales!inner(company_id)")
        .eq("sales.company_id", currentCompany?.id);

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
    enabled: canViewSales && canViewProducts && !!currentCompany?.id,
  });

  // Productos con stock crítico
  const { data: criticalStock } = useQuery({
    queryKey: ["critical-stock-list", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("name, stock, min_stock")
        .eq("company_id", currentCompany?.id)
        .lte("stock", 10)
        .order("stock", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: canViewProducts && !!currentCompany?.id,
  });

  const stats = [
    canViewSales && {
      title: "Ventas de Hoy",
      value: `$${salesData?.today.toFixed(2) || "0.00"}`,
      icon: DollarSign,
      description: "Ingresos del día actual",
      color: "text-green-600 dark:text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      trend: salesData?.today > 0 ? "+100%" : "0%",
    },
    canViewSales && {
      title: "Ventas Totales",
      value: salesData?.count || 0,
      icon: ShoppingCart,
      description: "Transacciones registradas",
      color: "text-blue-600 dark:text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      trend: null,
    },
    canViewProducts && {
      title: "Productos",
      value: productsCount || 0,
      icon: Package,
      description: `${lowStockProducts || 0} con stock bajo`,
      color: "text-purple-600 dark:text-purple-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
      alert: lowStockProducts > 0,
    },
    canViewCustomers && {
      title: "Clientes",
      value: customersCount || 0,
      icon: Users,
      description: "Clientes registrados",
      color: "text-orange-600 dark:text-orange-500",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      trend: null,
    },
  ].filter(Boolean);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Cargando permisos...</p>
        </div>
      </Layout>
    );
  }

  const hasAnyPermission = canViewSales || canViewProducts || canViewCustomers;

  if (!hasAnyPermission) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <AlertTriangle className="h-16 w-16 text-warning" />
          <h2 className="text-2xl font-bold text-foreground">Sin permisos de visualización</h2>
          <p className="text-muted-foreground text-center max-w-md">
            No tienes permisos para ver ninguna sección del dashboard. Contacta con tu administrador para obtener los permisos necesarios.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Vista general del negocio</p>
        </div>

        {stats.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.title} className={`shadow-soft hover:shadow-lg transition-all overflow-hidden border-l-4 ${stat.borderColor}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                    {stat.trend && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" />
                        {stat.trend}
                      </Badge>
                    )}
                    {stat.alert && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Alerta
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {canViewSales && (
          <>
            <Card className="shadow-soft border-l-4 border-green-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Activity className="h-5 w-5 text-green-600 dark:text-green-500" />
                    </div>
                    Resumen de Ventas
                  </CardTitle>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                    Últimos 30 días
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Total Acumulado</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-green-600 dark:text-green-500">
                        ${salesData?.total.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Promedio por Venta</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-blue-600 dark:text-blue-500">
                        ${salesData?.count ? (salesData.total / salesData.count).toFixed(2) : "0.00"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                  </div>
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
          </>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {canViewSales && canViewProducts && (
            <Card className="shadow-soft border-l-4 border-purple-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Package className="h-5 w-5 text-purple-600 dark:text-purple-500" />
                  </div>
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
                      fill="rgb(147 51 234)" 
                      radius={[0, 8, 8, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {canViewProducts && (
            <Card className="shadow-soft border-l-4 border-red-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
                  </div>
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
          )}
        </div>
      </div>
    </Layout>
  );
}
