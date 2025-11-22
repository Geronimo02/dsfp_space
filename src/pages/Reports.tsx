import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, Package, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight, RotateCw, AlertTriangle, Zap } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

import { useCompany } from "@/contexts/CompanyContext";

const Reports = () => {
  const { currentCompany } = useCompany();
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
    queryKey: ["reports-sales", dateRange, currentCompany?.id],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("sales")
        .select("created_at, total")
        .eq("company_id", currentCompany?.id)
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
    queryKey: ["reports-payment-methods", dateRange, currentCompany?.id],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("sales")
        .select("payment_method, total")
        .eq("company_id", currentCompany?.id)
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
    queryKey: ["reports-top-products", dateRange, currentCompany?.id],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          product_name,
          quantity,
          subtotal,
          sale_id,
          sales!inner(created_at, company_id)
        `)
        .eq("sales.company_id", currentCompany?.id)
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

  // Ventas por cliente
  const { data: salesByCustomer } = useQuery({
    queryKey: ["reports-sales-by-customer", dateRange, currentCompany?.id],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("sales")
        .select(`
          total,
          customer_id,
          customers (name)
        `)
        .eq("company_id", currentCompany?.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (error) throw error;

      const grouped = data.reduce((acc: any, sale: any) => {
        const customerName = sale.customers?.name || "Sin cliente";
        if (!acc[customerName]) {
          acc[customerName] = { name: customerName, total: 0, count: 0 };
        }
        acc[customerName].total += Number(sale.total);
        acc[customerName].count += 1;
        return acc;
      }, {});

      return Object.values(grouped).sort((a: any, b: any) => b.total - a.total);
    },
  });

  // Saldos de clientes
  const { data: customerBalances } = useQuery({
    queryKey: ["reports-customer-balances", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("name, current_balance, credit_limit")
        .eq("company_id", currentCompany?.id)
        .gt("current_balance", 0)
        .order("current_balance", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Resumen general
  const { data: summary } = useQuery({
    queryKey: ["reports-summary", dateRange, currentCompany?.id],
    queryFn: async () => {
      const { start, end } = getDateRange();

      // Ventas totales
      const { data: sales } = await supabase
        .from("sales")
        .select("total")
        .eq("company_id", currentCompany?.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      // Compras totales
      const { data: purchases } = await supabase
        .from("purchases")
        .select("total")
        .eq("company_id", currentCompany?.id)
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
        .select("*")
        .eq("company_id", currentCompany?.id);
      
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
    queryKey: ["reports-purchases", dateRange, currentCompany?.id],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("purchases")
        .select("created_at, total")
        .eq("company_id", currentCompany?.id)
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

  // Rotación de inventario
  const { data: rotationData } = useQuery({
    queryKey: ["reports-rotation", currentCompany?.id],
    queryFn: async () => {
      // Obtener productos con ventas en los últimos 90 días
      const ninetyDaysAgo = subDays(new Date(), 90);
      
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, stock, cost")
        .eq("company_id", currentCompany?.id)
        .eq("active", true);

      if (productsError) throw productsError;

      // Obtener ventas de cada producto en los últimos 90 días
      const { data: saleItems, error: salesError } = await supabase
        .from("sale_items")
        .select(`
          product_id,
          quantity,
          sales!inner(created_at, company_id)
        `)
        .eq("sales.company_id", currentCompany?.id)
        .gte("sales.created_at", ninetyDaysAgo.toISOString());

      if (salesError) throw salesError;

      // Calcular métricas por producto
      const productMetrics = products?.map(product => {
        const productSales = saleItems?.filter((item: any) => item.product_id === product.id) || [];
        const totalSold = productSales.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const avgDailySales = totalSold / 90;
        const rotationDays = avgDailySales > 0 ? product.stock / avgDailySales : 999;
        const lastSaleDate = productSales.length > 0 
          ? Math.max(...productSales.map((s: any) => new Date(s.sales.created_at).getTime()))
          : 0;
        const daysSinceLastSale = lastSaleDate ? Math.floor((Date.now() - lastSaleDate) / (1000 * 60 * 60 * 24)) : 999;

        let category = "Baja";
        if (rotationDays < 15) category = "Alta";
        else if (rotationDays < 45) category = "Media";
        
        return {
          id: product.id,
          name: product.name,
          stock: product.stock,
          totalSold,
          avgDailySales: avgDailySales.toFixed(2),
          rotationDays: Math.round(rotationDays),
          category,
          daysSinceLastSale,
          isDeadStock: daysSinceLastSale > 90,
          stockValue: product.stock * (product.cost || 0)
        };
      }) || [];

      return productMetrics.sort((a, b) => a.rotationDays - b.rotationDays);
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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="customers">Por Cliente</TabsTrigger>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="balances">Saldos</TabsTrigger>
            <TabsTrigger value="purchases">Compras</TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
            <TabsTrigger value="rotation">Rotación</TabsTrigger>
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

          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold">Cliente</th>
                        <th className="text-right p-2 font-semibold">Cantidad</th>
                        <th className="text-right p-2 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesByCustomer?.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2">{item.name}</td>
                          <td className="text-right p-2">{item.count}</td>
                          <td className="text-right p-2">${item.total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="balances" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Saldos de Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold">Cliente</th>
                        <th className="text-right p-2 font-semibold">Saldo</th>
                        <th className="text-right p-2 font-semibold">Límite</th>
                        <th className="text-right p-2 font-semibold">Disponible</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerBalances?.map((customer: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-2">{customer.name}</td>
                          <td className="text-right p-2 text-destructive">
                            ${customer.current_balance.toLocaleString()}
                          </td>
                          <td className="text-right p-2">
                            ${(customer.credit_limit || 0).toLocaleString()}
                          </td>
                          <td className="text-right p-2">
                            ${((customer.credit_limit || 0) - customer.current_balance).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

          <TabsContent value="rotation" className="space-y-4">
            {/* Resumen de rotación */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Alta Rotación</CardTitle>
                  <Zap className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {rotationData?.filter(p => p.category === "Alta").length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Productos con rotación {'<'} 15 días</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Baja Rotación</CardTitle>
                  <RotateCw className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {rotationData?.filter(p => p.category === "Baja" && !p.isDeadStock).length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Productos con rotación {'>'} 45 días</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Stock Muerto</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {rotationData?.filter(p => p.isDeadStock).length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Sin ventas en {'>'} 90 días</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabla de rotación */}
            <Card>
              <CardHeader>
                <CardTitle>Detalle de Rotación de Inventario</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold">Producto</th>
                        <th className="text-right p-2 font-semibold">Stock</th>
                        <th className="text-right p-2 font-semibold">Vendido (90d)</th>
                        <th className="text-right p-2 font-semibold">Días Rotación</th>
                        <th className="text-center p-2 font-semibold">Categoría</th>
                        <th className="text-right p-2 font-semibold">Última Venta</th>
                        <th className="text-right p-2 font-semibold">Valor Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rotationData?.map((item: any, idx: number) => (
                        <tr 
                          key={idx} 
                          className={`border-b hover:bg-muted/50 ${item.isDeadStock ? 'bg-destructive/5' : ''}`}
                        >
                          <td className="p-2">
                            {item.name}
                            {item.isDeadStock && (
                              <span className="ml-2 text-xs text-destructive">★ Muerto</span>
                            )}
                          </td>
                          <td className="text-right p-2">{item.stock}</td>
                          <td className="text-right p-2">{item.totalSold}</td>
                          <td className="text-right p-2">
                            <span className={
                              item.rotationDays < 15 ? 'text-green-600 font-semibold' :
                              item.rotationDays < 45 ? 'text-orange-600' :
                              'text-destructive'
                            }>
                              {item.rotationDays >= 999 ? '∞' : item.rotationDays}
                            </span>
                          </td>
                          <td className="text-center p-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                              ${item.category === 'Alta' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                item.category === 'Media' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="text-right p-2">
                            {item.daysSinceLastSale >= 999 ? 'Nunca' : `${item.daysSinceLastSale}d`}
                          </td>
                          <td className="text-right p-2">
                            ${item.stockValue.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reports;
