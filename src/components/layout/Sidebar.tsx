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
  BarChart3,
  FileText,
  Activity,
  FileSignature,
  PackageCheck,
  CreditCard,
  RotateCcw,
  Tag,
  CalendarCheck,
  DollarSign,
  Zap,
  Building2,
  ArrowLeftRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/hooks/usePermissions";

const navigationSections = [
  {
    title: "General",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Punto de Venta", href: "/pos", icon: ShoppingCart },
    ]
  },
  {
    title: "Ventas & Clientes",
    items: [
      { name: "Ventas", href: "/sales", icon: Receipt },
      { name: "Presupuestos", href: "/quotations", icon: FileSignature },
      { name: "Remitos", href: "/delivery-notes", icon: PackageCheck },
      { name: "Devoluciones", href: "/returns", icon: RotateCcw },
      { name: "Reservas", href: "/reservations", icon: CalendarCheck },
      { name: "Clientes", href: "/customers", icon: Users },
      { name: "Cuentas Corrientes", href: "/customer-account", icon: CreditCard },
    ]
  },
  {
    title: "Inventario & Compras",
    items: [
      { name: "Productos", href: "/products", icon: Package },
      { name: "Alertas de Inventario", href: "/inventory-alerts", icon: Activity },
      { name: "Depósitos", href: "/warehouses", icon: Building2 },
      { name: "Stock por Depósito", href: "/warehouse-stock", icon: Package },
      { name: "Transferencias", href: "/warehouse-transfers", icon: ArrowLeftRight },
      { name: "Compras", href: "/purchases", icon: ShoppingBag },
      { name: "Proveedores", href: "/suppliers", icon: Truck },
    ]
  },
  {
    title: "Gestión",
    items: [
      { name: "Servicios Técnicos", href: "/technical-services", icon: Wrench },
      { name: "Promociones", href: "/promotions", icon: Tag },
      { name: "Gestión de Caja", href: "/cash-register", icon: Wallet },
      { name: "Gastos", href: "/expenses", icon: DollarSign },
      { name: "Usuarios", href: "/employees", icon: UserCog },
    ]
  },
  {
    title: "Reportes & Admin",
    items: [
      { name: "Reportes", href: "/reports", icon: BarChart3 },
      { name: "Auditoría", href: "/audit-logs", icon: FileText },
      { name: "Logs de Acceso", href: "/access-logs", icon: Activity },
      { name: "Operaciones Masivas", href: "/bulk-operations", icon: Zap },
      { name: "Configuración", href: "/settings", icon: Settings },
    ]
  }
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isAdmin, loading } = usePermissions();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    } else {
      navigate("/auth");
      toast.success("Sesión cerrada exitosamente");
    }
  };

  const canViewMenuItem = (href: string): boolean => {
    // Admin sees everything
    if (isAdmin) return true;

    // Dashboard is always visible
    if (href === "/") return true;

    // Map routes to modules
    const routeToModule: Record<string, string> = {
      "/pos": "sales",
      "/sales": "sales",
      "/products": "products",
      "/inventory-alerts": "products",
      "/warehouses": "products",
      "/warehouse-stock": "products",
      "/warehouse-transfers": "products",
      "/customers": "customers",
      "/customer-account": "customers",
      "/suppliers": "suppliers",
      "/purchases": "purchases",
      "/reports": "reports",
      "/audit-logs": "reports",
      "/access-logs": "reports",
      "/employees": "employees",
      "/settings": "settings",
      "/cash-register": "cash_register",
      "/technical-services": "technical_services",
      "/quotations": "quotations",
      "/delivery-notes": "delivery_notes",
      "/promotions": "promotions",
      "/returns": "returns",
      "/reservations": "sales",
      "/expenses": "expenses",
      "/bulk-operations": "bulk_operations",
    };

    const module = routeToModule[href];
    if (!module) return false;

    return hasPermission(module as any, "view");
  };

  // Check if user can see any menu items
  const hasAnyVisibleItems = navigationSections.some(section => 
    section.items.some(item => canViewMenuItem(item.href))
  );

  if (loading) {
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
      </div>
    );
  }

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

      <nav className="flex-1 overflow-y-auto p-4 space-y-6 sidebar-scroll">
        {!hasAnyVisibleItems && !loading && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium mb-2">Sin permisos asignados</p>
            <p className="text-xs text-muted-foreground">
              Contacta al administrador para que te asigne permisos y puedas acceder a las funcionalidades del sistema.
            </p>
          </div>
        )}
        
        {navigationSections.map((section, index) => {
          const visibleItems = section.items.filter(item => canViewMenuItem(item.href));
          
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              {index > 0 && <Separator className="mb-4 bg-sidebar-border" />}
              <div className="mb-2 px-3">
                <h3 className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>
              <div className="space-y-1">
                {visibleItems.map((item) => {
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
                      <item.icon className="h-4 w-4" />
                      <span className="text-sm">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
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
