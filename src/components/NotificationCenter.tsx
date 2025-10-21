import { useEffect, useState } from "react";
import { Bell, AlertTriangle, ShoppingCart, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface Notification {
  id: string;
  type: "low_stock" | "big_sale" | "pending_service";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: any;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Query para stock bajo
  const { data: lowStockProducts } = useQuery({
    queryKey: ["low-stock-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, stock, min_stock")
        .lte("stock", 10)
        .order("stock", { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Cada minuto
  });

  // Query para servicios técnicos pendientes
  const { data: pendingServices } = useQuery({
    queryKey: ["pending-services-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technical_services")
        .select("id, service_number, device_type, status")
        .in("status", ["received", "in_diagnosis", "in_repair"])
        .order("received_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  // Suscripción a ventas en tiempo real
  useEffect(() => {
    const channel = supabase
      .channel("sales-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sales",
        },
        (payload) => {
          const sale = payload.new as any;
          
          // Solo notificar ventas grandes (más de 1000)
          if (Number(sale.total) > 1000) {
            const notification: Notification = {
              id: `sale-${sale.id}`,
              type: "big_sale",
              title: "💰 Venta Importante",
              message: `Nueva venta de $${Number(sale.total).toFixed(2)}`,
              timestamp: new Date().toISOString(),
              read: false,
              data: sale,
            };
            
            setNotifications((prev) => [notification, ...prev]);
            setUnreadCount((prev) => prev + 1);
            
            toast.success("¡Nueva venta importante!", {
              description: `Venta de $${Number(sale.total).toFixed(2)}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Actualizar notificaciones basadas en queries
  useEffect(() => {
    const newNotifications: Notification[] = [];

    // Notificaciones de stock bajo
    if (lowStockProducts && lowStockProducts.length > 0) {
      lowStockProducts.forEach((product) => {
        newNotifications.push({
          id: `stock-${product.id}`,
          type: "low_stock",
          title: "⚠️ Stock Bajo",
          message: `${product.name} - Stock: ${product.stock}`,
          timestamp: new Date().toISOString(),
          read: false,
          data: product,
        });
      });
    }

    // Notificaciones de servicios pendientes
    if (pendingServices && pendingServices.length > 0) {
      pendingServices.slice(0, 3).forEach((service) => {
        newNotifications.push({
          id: `service-${service.id}`,
          type: "pending_service",
          title: "🔧 Servicio Pendiente",
          message: `${service.service_number} - ${service.device_type}`,
          timestamp: new Date().toISOString(),
          read: false,
          data: service,
        });
      });
    }

    // Combinar con notificaciones existentes (ventas)
    const salesNotifications = notifications.filter(n => n.type === "big_sale");
    const combined = [...newNotifications, ...salesNotifications].slice(0, 20);
    
    setNotifications(combined);
    setUnreadCount(combined.filter(n => !n.read).length);
  }, [lowStockProducts, pendingServices]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "low_stock":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "big_sale":
        return <ShoppingCart className="h-4 w-4 text-success" />;
      case "pending_service":
        return <Wrench className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay notificaciones</p>
            </div>
          ) : (
            notifications.map((notification, index) => (
              <div key={notification.id}>
                <button
                  onClick={() => markAsRead(notification.id)}
                  className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                    !notification.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getIcon(notification.type)}</div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(notification.timestamp),
                          "dd/MM/yyyy HH:mm",
                          { locale: es }
                        )}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    )}
                  </div>
                </button>
                {index < notifications.length - 1 && <Separator />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
