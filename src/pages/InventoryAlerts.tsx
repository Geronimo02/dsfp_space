import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Calendar, 
  Package, 
  Search,
  MapPin,
  Loader2,
  DollarSign
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";

export default function InventoryAlerts() {
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const { data: lowStockProducts, isLoading: loadingLowStock } = useQuery({
    queryKey: ["low-stock-products", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("active", true)
        .order("stock", { ascending: true });

      if (error) throw error;
      
      // Filter products where stock <= min_stock
      return data?.filter(p => p.stock <= p.min_stock && p.min_stock > 0) || [];
    },
    enabled: !!currentCompany?.id,
  });

  const { data: expiringProducts, isLoading: loadingExpiring } = useQuery({
    queryKey: ["expiring-products", currentCompany?.id],
    queryFn: async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .not("expiration_date", "is", null)
        .lte("expiration_date", thirtyDaysFromNow.toISOString())
        .gte("expiration_date", new Date().toISOString())
        .eq("active", true)
        .order("expiration_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Currency alerts - detect significant rate changes
  const { data: currencyAlerts, isLoading: loadingCurrencyAlerts } = useQuery({
    queryKey: ["currency-alerts", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Get current rates
      const { data: currentRates, error: currentError } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id);
      
      if (currentError) throw currentError;
      
      // Get rates from 24 hours ago
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      
      const { data: previousRates, error: previousError } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id)
        .lte("updated_at", oneDayAgo.toISOString());
      
      if (previousError) throw previousError;
      
      // Calculate variations
      const alerts: any[] = [];
      const THRESHOLD_PERCENTAGE = 5; // Alert if change > 5%
      
      currentRates?.forEach(current => {
        const previous = previousRates?.find(p => p.currency === current.currency);
        if (previous) {
          const variation = ((current.rate - previous.rate) / previous.rate) * 100;
          if (Math.abs(variation) >= THRESHOLD_PERCENTAGE) {
            alerts.push({
              currency: current.currency,
              currentRate: current.rate,
              previousRate: previous.rate,
              variation: variation,
              severity: Math.abs(variation) >= 10 ? 'high' : 'medium',
              timestamp: current.updated_at
            });
          }
        }
      });
      
      return alerts;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: notifications, refetch: refetchNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) {
      toast.error("Error al marcar como leída");
      return;
    }

    refetchNotifications();
  };

  const checkAlerts = async () => {
    try {
      const { error: lowStockError } = await supabase.rpc("check_low_stock_alerts");
      if (lowStockError) throw lowStockError;

      const { error: expiringError } = await supabase.rpc("check_expiring_products");
      if (expiringError) throw expiringError;

      const { error: inactiveCustomersError } = await supabase.rpc("check_inactive_customers");
      if (inactiveCustomersError) throw inactiveCustomersError;

      const { error: overdueInvoicesError } = await supabase.rpc("check_overdue_invoices");
      if (overdueInvoicesError) throw overdueInvoicesError;

      const { error: expiringChecksError } = await supabase.rpc("check_expiring_checks");
      if (expiringChecksError) throw expiringChecksError;

      toast.success("Todas las alertas generadas exitosamente");
      refetchNotifications();
    } catch (error) {
      console.error("Error checking alerts:", error);
      toast.error("Error al generar alertas");
    }
  };

  const filteredLowStock = lowStockProducts?.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredExpiring = expiringProducts?.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.batch_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Alertas de Inventario</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Monitoreo de stock bajo y productos próximos a vencer
            </p>
          </div>
          <Button onClick={checkAlerts} className="w-full sm:w-auto">
            Generar Alertas
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Stock Bajo</p>
              <p className="text-2xl font-bold">{lowStockProducts?.length || 0}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Próximos a Vencer</p>
              <p className="text-2xl font-bold">{expiringProducts?.length || 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-warning" />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Alertas de Monedas</p>
              <p className="text-2xl font-bold">{currencyAlerts?.length || 0}</p>
              {currencyAlerts && currencyAlerts.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {currencyAlerts.filter((a: any) => a.severity === 'high').length} alta prioridad
                </p>
              )}
            </div>
            <DollarSign className="h-8 w-8 text-amber-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Notificaciones Sin Leer</p>
              <p className="text-2xl font-bold">
                {notifications?.filter((n) => !n.read).length || 0}
              </p>
            </div>
            <Package className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar productos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="low-stock" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="low-stock" className="flex-1 min-w-[120px] text-xs sm:text-sm">Stock Bajo</TabsTrigger>
          <TabsTrigger value="expiring" className="flex-1 min-w-[120px] text-xs sm:text-sm">Próx. Vencer</TabsTrigger>
          <TabsTrigger value="currency" className="flex-1 min-w-[120px] text-xs sm:text-sm">Monedas</TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 min-w-[120px] text-xs sm:text-sm">Notificaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="low-stock" className="space-y-4">
          {loadingLowStock ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredLowStock?.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No hay productos con stock bajo</p>
            </Card>
          ) : (
            filteredLowStock?.map((product) => (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{product.name}</h3>
                      <Badge variant="destructive">
                        Stock: {product.stock} / Min: {product.min_stock}
                      </Badge>
                    </div>
                    {product.sku && (
                      <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                    )}
                    {product.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {product.location}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/products?search=${encodeURIComponent(product.name)}`)}
                  >
                    Ver Detalles
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="expiring" className="space-y-4">
          {loadingExpiring ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredExpiring?.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No hay productos próximos a vencer
              </p>
            </Card>
          ) : (
            filteredExpiring?.map((product) => (
              <Card key={product.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{product.name}</h3>
                      <Badge variant="destructive">
                        Vence{" "}
                        {formatDistanceToNow(new Date(product.expiration_date), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </Badge>
                    </div>
                    {product.batch_number && (
                      <p className="text-sm text-muted-foreground">
                        Lote: {product.batch_number}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Fecha de vencimiento:{" "}
                      {new Date(product.expiration_date).toLocaleDateString("es")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Stock disponible: {product.stock} unidades
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/products?search=${encodeURIComponent(product.name)}`)}
                  >
                    Ver Detalles
                  </Button>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="currency" className="space-y-4">
          {loadingCurrencyAlerts ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : currencyAlerts?.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No hay variaciones significativas en las cotizaciones
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Se alertan variaciones mayores al 5% en las últimas 24 horas
              </p>
            </Card>
          ) : (
            currencyAlerts?.map((alert, index) => {
              const isPositive = alert.variation > 0;
              const Icon = isPositive ? AlertTriangle : AlertTriangle;
              
              return (
                <Card 
                  key={index} 
                  className={`p-4 border-l-4 ${
                    alert.severity === 'high' 
                      ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' 
                      : 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-6 w-6 ${alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'}`} />
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            {alert.currency}
                            <Badge variant={alert.severity === 'high' ? 'destructive' : 'default'}>
                              {isPositive ? '↑' : '↓'} {Math.abs(alert.variation).toFixed(2)}%
                            </Badge>
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Variación significativa en las últimas 24 horas
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Cotización Anterior:</p>
                          <p className="font-semibold">$ {alert.previousRate.toFixed(2)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Cotización Actual:</p>
                          <p className="font-semibold text-lg">$ {alert.currentRate.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Última actualización: {formatDistanceToNow(new Date(alert.timestamp), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </div>

                      {alert.severity === 'high' && (
                        <div className="p-3 bg-background rounded-lg border border-border">
                          <p className="text-sm font-medium mb-1">⚠️ Acción Recomendada</p>
                          <p className="text-xs text-muted-foreground">
                            {isPositive 
                              ? `Considera actualizar tus precios en ${alert.currency} para mantener la rentabilidad` 
                              : `Buen momento para comprar productos valuados en ${alert.currency}`
                            }
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/products")}
                    >
                      Revisar Productos
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          {notifications?.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No hay notificaciones</p>
            </Card>
          ) : (
            notifications?.map((notification) => (
              <Card
                key={notification.id}
                className={`p-4 ${notification.read ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{notification.title}</h3>
                      {!notification.read && (
                        <Badge variant="default">Nueva</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </p>
                  </div>
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(notification.id)}
                    >
                      Marcar como leída
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
    </Layout>
  );
}
