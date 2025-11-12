import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Loader2
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

      toast.success("Alertas generadas exitosamente");
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Alertas de Inventario</h1>
          <p className="text-muted-foreground">
            Monitoreo de stock bajo y productos próximos a vencer
          </p>
        </div>
        <Button onClick={checkAlerts}>
          Generar Alertas
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="low-stock">Stock Bajo</TabsTrigger>
          <TabsTrigger value="expiring">Próximos a Vencer</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
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
                    onClick={() => navigate("/products")}
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
                    onClick={() => navigate("/products")}
                  >
                    Ver Detalles
                  </Button>
                </div>
              </Card>
            ))
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
  );
}
