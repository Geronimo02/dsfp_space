import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Receipt, 
  Settings,
  LogOut,
  Wrench,
  Truck,
  UserCog,
  Wallet,
  ShoppingBag,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Punto de Venta", href: "/pos", icon: ShoppingCart },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Proveedores", href: "/suppliers", icon: Truck },
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Ventas", href: "/sales", icon: Receipt },
  { name: "Servicios Técnicos", href: "/technical-services", icon: Wrench },
  { name: "Empleados", href: "/employees", icon: UserCog },
  { name: "Gestión de Caja", href: "/cash-register", icon: Wallet },
  { name: "Compras", href: "/purchases", icon: ShoppingBag },
  { name: "Reportes", href: "/reports", icon: BarChart3 },
  { name: "Configuración", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    } else {
      navigate("/auth");
      toast.success("Sesión cerrada exitosamente");
    }
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-sidebar-foreground">RetailSnap</span>
          <span className="text-xs text-muted-foreground">Sistema POS</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}
