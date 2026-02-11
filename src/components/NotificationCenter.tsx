import { Bell } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function NotificationCenter() {
  const navigate = useNavigate();

  const { data: notifications, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    if (error) {
      toast.error("Error al marcar como leída");
      return;
    }

    refetch();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications && notifications.length > 0 ? (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`flex flex-col items-start p-3 cursor-pointer ${
                notification.read ? "opacity-60" : ""
              }`}
              onClick={() => {
                markAsRead(notification.id);
                if (notification.type === "low_stock" || notification.type === "expiring_product") {
                  navigate("/inventory-alerts");
                } else if (notification.type === "inactive_customer") {
                  const data = notification.data as any;
                  const customerId = data?.customer_id;
                  if (customerId) {
                    navigate(`/customer-account/${customerId}`);
                  }
                } else if (notification.type === "overdue_invoice") {
                  navigate("/accounts-receivable");
                } else if (notification.type === "expiring_check") {
                  navigate("/checks");
                } else if (notification.type?.startsWith("crm_")) {
                  navigate("/opportunities");
                }
              }}
            >
              <div className="flex justify-between w-full mb-1">
                <span className="font-medium">{notification.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                {notification.message}
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No hay notificaciones
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="text-center cursor-pointer"
          onClick={() => navigate("/inventory-alerts")}
        >
          Ver todas las notificaciones
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
