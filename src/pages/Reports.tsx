import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, Package, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight, RotateCw, AlertTriangle, Zap, CalendarIcon, RefreshCw, Wrench } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

import { useCompany } from "@/contexts/CompanyContext";

const Reports = () => {
  const { currentCompany } = useCompany();
  const [dateRangeType, setDateRangeType] = useState("7");
  const [reportCurrency, setReportCurrency] = useState("ARS");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const getDateRange = () => {
    if (dateRangeType === "custom" && customDateRange?.from && customDateRange?.to) {
      return {
        start: startOfDay(customDateRange.from),
        end: endOfDay(customDateRange.to),
      };
    }
    const days = parseInt(dateRangeType);
    return {
      start: startOfDay(subDays(new Date(), days)),
      end: endOfDay(new Date()),
    };
  };

  // Exchange rates query for currency conversion
  const { data: exchangeRates } = useQuery({
    queryKey: ["exchange-rates-reports", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Helper function to convert amounts
  const convertAmount = (amount: number, toCurrency: string = reportCurrency): number => {
    if (toCurrency === 'ARS' || !exchangeRates) return amount;
    
    const rate = exchangeRates.find(r => r.currency === toCurrency);
    if (rate && rate.rate > 0) {
      return amount / rate.rate;
    }
    return amount;
  };

  // Format amount with currency
  const formatCurrency = (amount: number): string => {
    return `${reportCurrency} ${convertAmount(amount).toFixed(2)}`;
  };

  // Ventas por día
  const { data: salesData } = useQuery({
    queryKey: ["reports-sales", dateRangeType, customDateRange, currentCompany?.id, reportCurrency],
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
        acc[day].total += convertAmount(Number(sale.total));
        acc[day].count += 1;
        return acc;
      }, {});

      return Object.values(groupedByDay);
    },
  });

  // Métodos de pago
  const { data: paymentMethodsData } = useQuery({
    queryKey: ["reports-payment-methods", dateRangeType, customDateRange, currentCompany?.id, reportCurrency],
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
        acc[method].value += convertAmount(Number(sale.total));
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });

  // Productos más vendidos
  const { data: topProductsData } = useQuery({
    queryKey: ["reports-top-products", dateRangeType, customDateRange, currentCompany?.id, reportCurrency],
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
        acc[name].revenue += convertAmount(Number(item.subtotal));
        return acc;
      }, {});

      return Object.values(grouped)
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 10);
    },
  });

  // Ventas por cliente
  const { data: salesByCustomer } = useQuery({
    queryKey: ["reports-sales-by-customer", dateRangeType, customDateRange, currentCompany?.id],
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
    queryKey: ["reports-summary", dateRangeType, customDateRange, currentCompany?.id],
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
    queryKey: ["reports-purchases", dateRangeType, customDateRange, currentCompany?.id],
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

  // Devoluciones
  const { data: returnsData } = useQuery({
    queryKey: ["reports-returns", dateRangeType, customDateRange, currentCompany?.id],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          sale:sales(sale_number, customer:customers(name))
        `)
        .eq("company_id", currentCompany?.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calcular estadísticas
      const totalReturns = data?.length || 0;
      const totalAmount = data?.reduce((sum, r) => sum + Number(r.total), 0) || 0;
      const byStatus = data?.reduce((acc: any, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      const byRefundMethod = data?.reduce((acc: any, r) => {
        acc[r.refund_method] = (acc[r.refund_method] || 0) + 1;
        return acc;
      }, {});

      return { 
        returns: data, 
        totalReturns,
        totalAmount,
        byStatus,
        byRefundMethod
      };
    },
    enabled: !!currentCompany?.id,
  });

  // Servicios técnicos (arreglos)
  const { data: repairsData } = useQuery({
    queryKey: ["reports-repairs", dateRangeType, customDateRange, currentCompany?.id],
    queryFn: async () => {
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("technical_services")
        .select(`
          *,
          customer:customers(name)
        `)
        .eq("company_id", currentCompany?.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calcular estadísticas
      const totalRepairs = data?.length || 0;
      const totalRevenue = data?.reduce((sum, r) => sum + Number(r.total_cost || 0), 0) || 0;
      const byStatus = data?.reduce((acc: any, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});
      const avgRepairTime = data?.reduce((sum, r) => {
        if (r.status === 'delivered' && r.completed_date) {
          const start = new Date(r.created_at);
          const end = new Date(r.completed_date);
          return sum + Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }
        return sum;
      }, 0) / (data?.filter(r => r.status === 'delivered').length || 1);

      return { 
        repairs: data, 
        totalRepairs,
        totalRevenue,
        byStatus,
        avgRepairTime: Math.round(avgRepairTime)
      };
    },
    enabled: !!currentCompany?.id,
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
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Reportes</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Visualiza el rendimiento de tu negocio</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={dateRangeType} onValueChange={setDateRangeType}>
              <SelectTrigger className="w-[130px] md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="15">Últimos 15 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="custom">Rango personalizado</SelectItem>
              </SelectContent>
            </Select>
            
            {dateRangeType === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal min-w-[240px]",
                      !customDateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDateRange?.from ? (
                      customDateRange.to ? (
                        <>
                          {format(customDateRange.from, "dd/MM/yyyy", { locale: es })} -{" "}
                          {format(customDateRange.to, "dd/MM/yyyy", { locale: es })}
                        </>
                      ) : (
                        format(customDateRange.from, "dd/MM/yyyy", { locale: es })
                      )
                    ) : (
                      <span>Seleccionar fechas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={customDateRange?.from}
                    selected={customDateRange}
                    onSelect={setCustomDateRange}
                    numberOfMonths={2}
                    locale={es}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
            
            <Select value={reportCurrency} onValueChange={setReportCurrency}>
              <SelectTrigger className="w-[100px] md:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="UYU">UYU</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Resumen de métricas */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Ventas Totales"
            value={formatCurrency(summary?.totalSales || 0)}
            icon={DollarSign}
            trend="up"
            trendValue={`${summary?.salesCount || 0} ventas`}
          />
          <StatCard
            title="Compras Totales"
            value={formatCurrency(summary?.totalPurchases || 0)}
            icon={ShoppingCart}
          />
          <StatCard
            title="Ganancia Bruta"
            value={formatCurrency(summary?.profit || 0)}
            icon={TrendingUp}
            trend={summary?.profit >= 0 ? "up" : "down"}
            trendValue={`${((summary?.profit / summary?.totalSales) * 100 || 0).toFixed(1)}%`}
          />
          <StatCard
            title="Balance de Caja"
            value={formatCurrency(summary?.cashBalance || 0)}
            icon={Wallet}
          />
        </div>

        {/* Gráficos */}
        <Tabs defaultValue="sales" className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-9">
              <TabsTrigger value="sales" className="text-xs md:text-sm">Ventas</TabsTrigger>
              <TabsTrigger value="customers" className="text-xs md:text-sm">Clientes</TabsTrigger>
              <TabsTrigger value="products" className="text-xs md:text-sm">Productos</TabsTrigger>
              <TabsTrigger value="balances" className="text-xs md:text-sm">Saldos</TabsTrigger>
              <TabsTrigger value="purchases" className="text-xs md:text-sm">Compras</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs md:text-sm">Pagos</TabsTrigger>
              <TabsTrigger value="rotation" className="text-xs md:text-sm">Rotación</TabsTrigger>
              <TabsTrigger value="returns" className="text-xs md:text-sm">Devoluciones</TabsTrigger>
              <TabsTrigger value="repairs" className="text-xs md:text-sm">Arreglos</TabsTrigger>
            </TabsList>
          </div>

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

          {/* Tab de Devoluciones */}
          <TabsContent value="returns" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Devoluciones</CardTitle>
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{returnsData?.totalReturns || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(returnsData?.totalAmount || 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{returnsData?.byStatus?.['pending'] || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aprobadas</CardTitle>
                  <RefreshCw className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{returnsData?.byStatus?.['approved'] || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completadas</CardTitle>
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{returnsData?.byStatus?.['completed'] || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Métodos de Reembolso</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(returnsData?.byRefundMethod || {}).map(([method, count]) => ({
                        name: method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : method === 'credit_note' ? 'Nota de Crédito' : 'Cambio',
                        value: count
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.keys(returnsData?.byRefundMethod || {}).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de Devoluciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold">Nº Devolución</th>
                        <th className="text-left p-2 font-semibold">Venta</th>
                        <th className="text-left p-2 font-semibold">Cliente</th>
                        <th className="text-right p-2 font-semibold">Total</th>
                        <th className="text-center p-2 font-semibold">Estado</th>
                        <th className="text-center p-2 font-semibold">Método</th>
                        <th className="text-right p-2 font-semibold">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnsData?.returns?.map((ret: any) => (
                        <tr key={ret.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">{ret.return_number}</td>
                          <td className="p-2">{ret.sale?.sale_number}</td>
                          <td className="p-2">{ret.sale?.customer?.name}</td>
                          <td className="text-right p-2">{formatCurrency(ret.total)}</td>
                          <td className="text-center p-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                              ${ret.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                ret.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                ret.status === 'pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {ret.status === 'pending' ? 'Pendiente' :
                               ret.status === 'approved' ? 'Aprobada' :
                               ret.status === 'completed' ? 'Completada' : 'Rechazada'}
                            </span>
                          </td>
                          <td className="text-center p-2">
                            {ret.refund_method === 'cash' ? 'Efectivo' :
                             ret.refund_method === 'card' ? 'Tarjeta' :
                             ret.refund_method === 'credit_note' ? 'N. Crédito' : 'Cambio'}
                          </td>
                          <td className="text-right p-2">
                            {format(new Date(ret.created_at), "dd/MM/yyyy", { locale: es })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Arreglos/Servicios Técnicos */}
          <TabsContent value="repairs" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Arreglos</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{repairsData?.totalRepairs || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(repairsData?.totalRevenue || 0)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">En Reparación</CardTitle>
                  <RotateCw className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{repairsData?.byStatus?.['in_repair'] || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Listos</CardTitle>
                  <Zap className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{repairsData?.byStatus?.['ready'] || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                  <Wrench className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{repairsData?.avgRepairTime || 0}d</div>
                  <p className="text-xs text-muted-foreground">días</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Estados de Arreglos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(repairsData?.byStatus || {}).map(([status, count]) => ({
                        name: status === 'pending' ? 'Pendiente' :
                              status === 'diagnosing' ? 'Diagnóstico' :
                              status === 'awaiting_parts' ? 'Esperando Repuestos' :
                              status === 'in_repair' ? 'En Reparación' :
                              status === 'ready' ? 'Listo' :
                              status === 'delivered' ? 'Entregado' : 'Cancelado',
                        value: count
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.keys(repairsData?.byStatus || {}).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalle de Arreglos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-semibold">Nº Servicio</th>
                        <th className="text-left p-2 font-semibold">Cliente</th>
                        <th className="text-left p-2 font-semibold">Dispositivo</th>
                        <th className="text-left p-2 font-semibold">Problema</th>
                        <th className="text-right p-2 font-semibold">Costo</th>
                        <th className="text-center p-2 font-semibold">Estado</th>
                        <th className="text-right p-2 font-semibold">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repairsData?.repairs?.map((repair: any) => (
                        <tr key={repair.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">{repair.service_number}</td>
                          <td className="p-2">{repair.customer?.name}</td>
                          <td className="p-2">{repair.device_type}</td>
                          <td className="p-2 max-w-xs truncate">{repair.reported_issue}</td>
                          <td className="text-right p-2">{formatCurrency(repair.service_cost || 0)}</td>
                          <td className="text-center p-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                              ${repair.status === 'delivered' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                repair.status === 'ready' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                repair.status === 'in_repair' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                                repair.status === 'awaiting_parts' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                repair.status === 'diagnosing' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                                repair.status === 'pending' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' :
                                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {repair.status === 'pending' ? 'Pendiente' :
                               repair.status === 'diagnosing' ? 'Diagnóstico' :
                               repair.status === 'awaiting_parts' ? 'Esp. Repuestos' :
                               repair.status === 'in_repair' ? 'Reparando' :
                               repair.status === 'ready' ? 'Listo' :
                               repair.status === 'delivered' ? 'Entregado' : 'Cancelado'}
                            </span>
                          </td>
                          <td className="text-right p-2">
                            {format(new Date(repair.created_at), "dd/MM/yyyy", { locale: es })}
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
