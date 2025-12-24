import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, ShoppingCart, TrendingUp, Users, AlertTriangle, BarChart3, Activity, ArrowUpRight, ArrowDownRight, TrendingDown, Calendar } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";
import { BusinessHealthPanel } from "@/components/dashboard/BusinessHealthPanel";

export default function Dashboard() {
  const { currentCompany } = useCompany();
  const { hasPermission, loading } = usePermissions();
  const canViewSales = hasPermission("sales", "view");
  const canViewProducts = hasPermission("products", "view");
  const canViewCustomers = hasPermission("customers", "view");

  // Ventas del mes actual vs mes pasado
  const { data: monthlyComparison } = useQuery({
    queryKey: ["monthly-comparison", currentCompany?.id],
    queryFn: async () => {
      const currentMonthStart = startOfMonth(new Date());
      const currentMonthEnd = endOfMonth(new Date());
      const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
      const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));

      const { data: currentMonth, error: currentError } = await supabase
        .from("sales")
        .select("total, sale_items(quantity, unit_price, subtotal)")
        .eq("company_id", currentCompany?.id)
        .gte("created_at", currentMonthStart.toISOString())
        .lte("created_at", currentMonthEnd.toISOString());

      const { data: lastMonth, error: lastError } = await supabase
        .from("sales")
        .select("total")
        .eq("company_id", currentCompany?.id)
        .gte("created_at", lastMonthStart.toISOString())
        .lte("created_at", lastMonthEnd.toISOString());

      if (currentError || lastError) throw currentError || lastError;

      const currentTotal = currentMonth?.reduce((acc, sale) => acc + Number(sale.total), 0) || 0;
      const lastTotal = lastMonth?.reduce((acc, sale) => acc + Number(sale.total), 0) || 0;
      
      // Calcular costos para margen bruto
      let totalCost = 0;
      currentMonth?.forEach(sale => {
        sale.sale_items?.forEach((item: any) => {
          // Estimamos el costo como 60% del precio de venta si no está disponible
          totalCost += Number(item.subtotal) * 0.6;
        });
      });
      
      const grossMargin = currentTotal - totalCost;
      const marginPercentage = currentTotal > 0 ? (grossMargin / currentTotal) * 100 : 0;

      const percentageChange = lastTotal > 0 
        ? ((currentTotal - lastTotal) / lastTotal) * 100 
        : 100;

      return {
        currentMonth: currentTotal,
        lastMonth: lastTotal,
        percentageChange,
        grossMargin,
        marginPercentage,
        isPositive: percentageChange >= 0
      };
    },
    enabled: canViewSales && !!currentCompany?.id,
  });

  // Top 5 productos por rentabilidad
  const { data: topProfitableProducts } = useQuery({
    queryKey: ["top-profitable-products", currentCompany?.id],
    queryFn: async () => {
      const currentMonthStart = startOfMonth(new Date());
      
      const { data: saleItems, error } = await supabase
        .from("sale_items")
        .select(`
          product_id,
          product_name,
          quantity,
          unit_price,
          subtotal,
          sales!inner(created_at, company_id)
        `)
        .eq("sales.company_id", currentCompany?.id)
        .gte("sales.created_at", currentMonthStart.toISOString());

      if (error) throw error;

      const productMap = new Map<string, { name: string; revenue: number; quantity: number }>();
      
      saleItems?.forEach((item: any) => {
        const existing = productMap.get(item.product_id) || { name: item.product_name, revenue: 0, quantity: 0 };
        productMap.set(item.product_id, {
          name: item.product_name,
          revenue: existing.revenue + Number(item.subtotal),
          quantity: existing.quantity + item.quantity
        });
      });

      return Array.from(productMap.values())
        .map(p => ({ 
          producto: p.name, 
          rentabilidad: p.revenue,
          unidades: p.quantity 
        }))
        .sort((a, b) => b.rentabilidad - a.rentabilidad)
        .slice(0, 5);
    },
    enabled: canViewSales && canViewProducts && !!currentCompany?.id,
  });

  // Top 5 clientes que más compran
  const { data: topCustomers } = useQuery({
    queryKey: ["top-customers", currentCompany?.id],
    queryFn: async () => {
      const currentMonthStart = startOfMonth(new Date());
      
      const { data, error } = await supabase
        .from("sales")
        .select("customer_id, total, customers(name)")
        .eq("company_id", currentCompany?.id)
        .gte("created_at", currentMonthStart.toISOString())
        .not("customer_id", "is", null);

      if (error) throw error;

      const customerMap = new Map<string, { name: string; total: number; count: number }>();
      
      data?.forEach((sale: any) => {
        const customerId = sale.customer_id;
        const customerName = sale.customers?.name || "Sin nombre";
        const existing = customerMap.get(customerId) || { name: customerName, total: 0, count: 0 };
        customerMap.set(customerId, {
          name: customerName,
          total: existing.total + Number(sale.total),
          count: existing.count + 1
        });
      });

      return Array.from(customerMap.values())
        .map(c => ({ 
          cliente: c.name, 
          total: c.total,
          compras: c.count
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
    enabled: canViewSales && canViewCustomers && !!currentCompany?.id,
  });

  // Facturas vencidas y por cobrar
  const { data: receivables } = useQuery({
    queryKey: ["receivables", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_account_movements")
        .select("debit_amount, status, due_date")
        .eq("company_id", currentCompany?.id)
        .eq("movement_type", "sale")
        .in("status", ["pending", "partial"]);

      if (error) throw error;

      const today = new Date();
      let overdue = 0;
      let total = 0;

      data?.forEach(movement => {
        const amount = Number(movement.debit_amount);
        total += amount;
        
        if (movement.due_date && new Date(movement.due_date) < today) {
          overdue += amount;
        }
      });

      const overduePercentage = total > 0 ? (overdue / total) * 100 : 0;

      return {
        overdue,
        total,
        overduePercentage,
        overdueCount: data?.filter(m => m.due_date && new Date(m.due_date) < new Date()).length || 0
      };
    },
    enabled: canViewSales && !!currentCompany?.id,
  });

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

  // Exchange rates and currency dashboard
  const { data: exchangeRates } = useQuery({
    queryKey: ["exchange-rates-dashboard", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("currency", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Historical exchange rates for charts (last 30 days)
  const { data: historicalRates } = useQuery({
    queryKey: ["historical-rates", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const thirtyDaysAgo = subDays(new Date(), 30);
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id)
        .gte("updated_at", thirtyDaysAgo.toISOString())
        .in("currency", ["USD", "EUR"])
        .order("updated_at", { ascending: true });
      if (error) throw error;
      
      // Group by date and currency
      const grouped: any = {};
      data?.forEach(rate => {
        const dateKey = format(new Date(rate.updated_at), "dd/MM");
        if (!grouped[dateKey]) {
          grouped[dateKey] = { date: dateKey };
        }
        grouped[dateKey][rate.currency] = rate.rate;
      });
      
      return Object.values(grouped);
    },
    enabled: !!currentCompany?.id,
  });

  // Inventory valuation by currency
  const { data: inventoryByCurrency } = useQuery({
    queryKey: ["inventory-by-currency", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data: products, error } = await supabase
        .from("products")
        .select("currency, price, stock, cost")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      
      if (error) throw error;
      
      // Get exchange rates
      const { data: rates } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id);
      
      // Group by currency and calculate totals
      const grouped: any = {};
      products?.forEach(product => {
        const currency = (product as any).currency || 'ARS';
        if (!grouped[currency]) {
          grouped[currency] = {
            currency,
            totalValue: 0,
            totalCost: 0,
            productCount: 0,
            valueInARS: 0
          };
        }
        
        const value = Number(product.price) * Number(product.stock);
        const cost = Number(product.cost) * Number(product.stock);
        
        grouped[currency].totalValue += value;
        grouped[currency].totalCost += cost;
        grouped[currency].productCount += 1;
        
        // Convert to ARS
        if (currency === 'ARS') {
          grouped[currency].valueInARS += value;
        } else {
          const rate = rates?.find(r => r.currency === currency);
          if (rate) {
            grouped[currency].valueInARS += value * rate.rate;
          }
        }
      });
      
      return Object.values(grouped);
    },
    enabled: canViewProducts && !!currentCompany?.id,
  });

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
      <div className="space-y-4 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">Panel de control y salud del negocio</p>
        </div>

        {/* Business Health Panel */}
        {currentCompany?.id && (
          <BusinessHealthPanel companyId={currentCompany.id} />
        )}

        {canViewSales && (
          <div className="grid gap-3 md:gap-6 grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-soft hover:shadow-lg transition-all overflow-hidden border-l-4 border-blue-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                  Ventas del Mes
                </CardTitle>
                <div className="p-1.5 md:p-2.5 rounded-lg bg-blue-500/10">
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-500" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 md:space-y-2 p-3 md:p-6 pt-0 md:pt-0">
                <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-2">
                  <div className="text-xl md:text-3xl font-bold text-foreground">
                    ${monthlyComparison?.currentMonth.toFixed(0) || "0"}
                  </div>
                  {monthlyComparison && (
                    <Badge 
                      variant="outline" 
                      className={`${
                        monthlyComparison.isPositive 
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" 
                          : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                      } flex items-center gap-1`}
                    >
                      {monthlyComparison.isPositive ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(monthlyComparison.percentageChange).toFixed(1)}%
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground hidden md:block">
                  vs mes pasado: ${monthlyComparison?.lastMonth.toFixed(0) || "0"}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-lg transition-all overflow-hidden border-l-4 border-green-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                  Margen Bruto
                </CardTitle>
                <div className="p-1.5 md:p-2.5 rounded-lg bg-green-500/10">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-500" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 md:space-y-2 p-3 md:p-6 pt-0 md:pt-0">
                <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-2">
                  <div className="text-xl md:text-3xl font-bold text-foreground">
                    ${monthlyComparison?.grossMargin.toFixed(0) || "0"}
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] md:text-xs w-fit">
                    {monthlyComparison?.marginPercentage.toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground hidden md:block">
                  Rentabilidad del mes
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-lg transition-all overflow-hidden border-l-4 border-orange-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                  Por Cobrar
                </CardTitle>
                <div className="p-1.5 md:p-2.5 rounded-lg bg-orange-500/10">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-orange-600 dark:text-orange-500" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 md:space-y-2 p-3 md:p-6 pt-0 md:pt-0">
                <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-2">
                  <div className="text-xl md:text-3xl font-bold text-foreground">
                    ${receivables?.total.toFixed(0) || "0"}
                  </div>
                  {receivables && receivables.overduePercentage > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 text-[10px] md:text-xs w-fit">
                      {receivables.overduePercentage.toFixed(0)}% venc.
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground hidden md:block">
                  Vencidas: ${receivables?.overdue.toFixed(0) || "0"} ({receivables?.overdueCount || 0})
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-lg transition-all overflow-hidden border-l-4 border-purple-500/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                  Ventas Hoy
                </CardTitle>
                <div className="p-1.5 md:p-2.5 rounded-lg bg-purple-500/10">
                  <Activity className="h-4 w-4 md:h-5 md:w-5 text-purple-600 dark:text-purple-500" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 md:space-y-2 p-3 md:p-6 pt-0 md:pt-0">
                <div className="flex items-baseline gap-2">
                  <div className="text-xl md:text-3xl font-bold text-foreground">
                    ${salesData?.today.toFixed(0) || "0"}
                  </div>
                </div>
                <p className="text-[10px] md:text-xs text-muted-foreground hidden md:block">
                  Ingresos del día actual
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Currency Dashboard Widget */}
          {exchangeRates && exchangeRates.length > 0 && (
            <div className="col-span-full">
              <Card className="shadow-soft border-l-4 border-amber-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                    </div>
                    Dashboard de Monedas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Current Exchange Rates */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">Cotizaciones Actuales</h3>
                      <div className="space-y-2">
                        {exchangeRates.map((rate) => {
                          const prevRate = rate.rate * 0.98; // Simulamos variación previa
                          const variation = ((rate.rate - prevRate) / prevRate) * 100;
                          const isPositive = variation >= 0;
                          
                          return (
                            <div 
                              key={rate.currency}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-sm">{rate.currency}</div>
                                <Badge variant="outline" className="text-xs">
                                  {rate.currency === 'USD' ? '🇺🇸' : rate.currency === 'EUR' ? '🇪🇺' : rate.currency === 'BRL' ? '🇧🇷' : rate.currency === 'UYU' ? '🇺🇾' : '💱'}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-sm">${rate.rate.toFixed(2)}</div>
                                <div className={`text-xs flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                  {Math.abs(variation).toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Última actualización: {exchangeRates[0] ? format(new Date(exchangeRates[0].updated_at), "dd/MM/yyyy HH:mm", { locale: es }) : '-'}
                      </p>
                    </div>

                    {/* Exchange Rate Evolution Chart */}
                    {historicalRates && historicalRates.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground">Evolución (30 días)</h3>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={historicalRates}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px'
                              }}
                              formatter={(value: number) => [`$${value.toFixed(2)}`]}
                            />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="USD" 
                              stroke="#22c55e" 
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="EUR" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Inventory Valuation by Currency */}
                    {inventoryByCurrency && inventoryByCurrency.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground">Valorización de Inventario</h3>
                        <div className="space-y-2">
                          {inventoryByCurrency.map((item: any) => (
                            <div 
                              key={item.currency}
                              className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sm">{item.currency}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {item.productCount} productos
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Valor:</span>
                                  <span className="font-medium">{item.currency} {item.totalValue.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">En ARS:</span>
                                  <span className="font-medium">$ {item.valueInARS.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">Margen:</span>
                                  <span className="font-medium text-green-600">
                                    {item.totalValue > 0 ? (((item.totalValue - item.totalCost) / item.totalValue) * 100).toFixed(1) : 0}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/30">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold">Total General (ARS)</span>
                              <span className="text-lg font-bold">
                                ${Number(inventoryByCurrency.reduce((acc: number, item: any) => acc + (item.valueInARS || 0), 0)).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {canViewSales && canViewProducts && (
            <>
              <Card className="shadow-soft border-l-4 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-500" />
                    </div>
                    Top 5 Productos por Rentabilidad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProfitableProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-sm" />
                      <YAxis dataKey="producto" type="category" width={100} className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Rentabilidad']}
                      />
                      <Bar 
                        dataKey="rentabilidad" 
                        fill="rgb(147 51 234)" 
                        radius={[0, 8, 8, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-soft border-l-4 border-blue-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                    </div>
                    Top 5 Clientes del Mes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topCustomers} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-sm" />
                      <YAxis dataKey="cliente" type="category" width={100} className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Total Comprado']}
                      />
                      <Bar 
                        dataKey="total" 
                        fill="rgb(59 130 246)" 
                        radius={[0, 8, 8, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {canViewSales && (
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
    </Layout>
  );
}
