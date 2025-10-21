import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, Package, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const Reports = () => {
  const [dateRange, setDateRange] = useState("7");

  const getDateRange = () => {
    const days = parseInt(dateRange);
    return {
      start: startOfDay(subDays(new Date(), days)),
      end: endOfDay(new Date()),
    };
  };

  // Ventas por día
  const { data: salesData } = useQuery({
    queryKey: ["reports-sales", dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("sales")
        .select("created_at, total")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at");

      if (error) throw error;

      // Agrupar por día
      const groupedByDay = data.reduce((acc: any, sale) => {
        const day = format(new Date(sale.created_at), "dd/MMM", { locale: es });
        if (!acc[day]) {
          acc[day] = { day, total: 0, count: 0 };
        }
        acc[day].total += Number(sale.total);
        acc[day].count += 1;
        return acc;
      }, {});

      return Object.values(groupedByDay);
    },
  });

  // Métodos de pago
  const { data: paymentMethodsData } = useQuery({
    queryKey: ["reports-payment-methods", dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("sales")
        .select("payment_method, total")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (error) throw error;

      const grouped = data.reduce((acc: any, sale) => {
        const method = sale.payment_method;
        if (!acc[method]) {
          acc[method] = { name: method, value: 0 };
        }
        acc[method].value += Number(sale.total);
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });

  // Productos más vendidos
  const { data: topProductsData } = useQuery({
    queryKey: ["reports-top-products", dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          product_name,
          quantity,
          subtotal,
          sale_id,
          sales!inner(created_at)
        `)
        .gte("sales.created_at", start.toISOString())
        .lte("sales.created_at", end.toISOString());

      if (error) throw error;

      const grouped = data.reduce((acc: any, item) => {
        const name = item.product_name;
        if (!acc[name]) {
          acc[name] = { name, quantity: 0, revenue: 0 };
        }
        acc[name].quantity += item.quantity;
        acc[name].revenue += Number(item.subtotal);
        return acc;
      }, {});

      return Object.values(grouped)
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 10);
    },
  });

  // Resumen general
  const { data: summary } = useQuery({
    queryKey: ["reports-summary", dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();

      // Ventas totales
      const { data: sales } = await supabase
        .from("sales")
        .select("total")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      // Compras totales
      const { data: purchases } = await supabase
        .from("purchases")
        .select("total")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      // Movimientos de caja
      const { data: cashMovements } = await supabase
        .from("cash_movements")
        .select("amount, type")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      // Productos con stock bajo
      const { data: products } = await supabase
        .from("products")
        .select("*");
      
      const lowStock = products?.filter(p => p.stock < (p.min_stock || 0)) || [];

      const totalSales = sales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
      const totalPurchases = purchases?.reduce((sum, p) => sum + Number(p.total), 0) || 0;
      const totalCashIn = cashMovements?.filter(m => m.type === "income").reduce((sum, m) => sum + Number(m.amount), 0) || 0;
      const totalCashOut = cashMovements?.filter(m => m.type === "expense").reduce((sum, m) => sum + Number(m.amount), 0) || 0;

      return {
        totalSales,
        totalPurchases,
        profit: totalSales - totalPurchases,
        cashBalance: totalCashIn - totalCashOut,
        lowStockCount: lowStock.length,
        salesCount: sales?.length || 0,
      };
    },
  });

  // Compras por día
  const { data: purchasesData } = useQuery({
    queryKey: ["reports-purchases", dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("purchases")
        .select("created_at, total")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at");

      if (error) throw error;

      const groupedByDay = data.reduce((acc: any, purchase) => {
        const day = format(new Date(purchase.created_at), "dd/MMM", { locale: es });
        if (!acc[day]) {
          acc[day] = { day, total: 0 };
        }
        acc[day].total += Number(purchase.total);
        return acc;
      }, {});

      return Object.values(groupedByDay);
    },
  });

  const StatCard = ({ title, value, icon: Icon, trend, trendValue }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <div className={`flex items-center text-sm ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
            {trend === "up" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            <span className="ml-1">{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reportes y Análisis</h1>
            <p className="text-muted-foreground">Visualiza el rendimiento de tu negocio</p>
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="15">Últimos 15 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resumen de métricas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ventas Totales"
            value={`$${summary?.totalSales.toFixed(2) || "0.00"}`}
            icon={DollarSign}
            trend="up"
            trendValue={`${summary?.salesCount || 0} ventas`}
          />
          <StatCard
            title="Compras Totales"
            value={`$${summary?.totalPurchases.toFixed(2) || "0.00"}`}
            icon={ShoppingCart}
          />
          <StatCard
            title="Ganancia Bruta"
            value={`$${summary?.profit.toFixed(2) || "0.00"}`}
            icon={TrendingUp}
            trend={summary?.profit >= 0 ? "up" : "down"}
            trendValue={`${((summary?.profit / summary?.totalSales) * 100 || 0).toFixed(1)}%`}
          />
          <StatCard
            title="Balance de Caja"
            value={`$${summary?.cashBalance.toFixed(2) || "0.00"}`}
            icon={Wallet}
          />
        </div>

        {/* Gráficos */}
        <Tabs defaultValue="sales" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="purchases">Compras</TabsTrigger>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="payments">Métodos de Pago</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Día</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill="hsl(var(--chart-1))" name="Total ($)" />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" name="N° Ventas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Compras por Día</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={purchasesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-3))" name="Total ($)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Productos Más Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProductsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="hsl(var(--chart-4))" name="Ingresos ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Método de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethodsData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: $${entry.value.toFixed(2)}`}
                      outerRadius={80}
                      fill="hsl(var(--chart-1))"
                      dataKey="value"
                    >
                      {paymentMethodsData?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reports;
