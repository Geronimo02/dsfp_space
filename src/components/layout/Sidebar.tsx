import { useLocation, useNavigate } from "react-router-dom";
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
  ArrowLeftRight,
  Bell,
  CreditCard as CheckIcon,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar as SidebarUI,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

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
      { name: "Cheques", href: "/checks", icon: CheckIcon },
      { name: "Gastos", href: "/expenses", icon: DollarSign },
      { name: "Usuarios", href: "/employees", icon: UserCog },
    ]
  },
  {
    title: "Reportes & Admin",
    items: [
      { name: "Reportes", href: "/reports", icon: BarChart3 },
      { name: "Cierre Mensual", href: "/monthly-closing", icon: CheckCircle },
      { name: "Auditoría", href: "/audit-logs", icon: FileText },
      { name: "Logs de Acceso", href: "/access-logs", icon: Activity },
      { name: "Operaciones Masivas", href: "/bulk-operations", icon: Zap },
      { name: "Puntos de Venta AFIP", href: "/pos-points", icon: Receipt },
      { name: "Notificaciones", href: "/notification-settings", icon: Bell },
      { name: "Configuración", href: "/settings", icon: Settings },
    ]
  }
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, isAdmin, loading } = usePermissions();
  const { state } = useSidebar();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error al cerrar sesión");
    } else {
      // Limpiar localStorage para evitar problemas con company_id al cambiar de usuario
      localStorage.removeItem('currentCompanyId');
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
      "/checks": "cash_register",
      "/technical-services": "technical_services",
      "/quotations": "quotations",
      "/delivery-notes": "delivery_notes",
      "/promotions": "promotions",
      "/returns": "returns",
      "/reservations": "sales",
      "/expenses": "expenses",
      "/bulk-operations": "bulk_operations",
      "/pos-points": "pos_afip",
      "/notification-settings": "settings",
      "/monthly-closing": "reports",
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
      <SidebarUI collapsible="icon">
        <SidebarContent>
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            </div>
            {state !== "collapsed" && (
              <div className="flex flex-col">
                <span className="text-sm font-bold">RetailSnap</span>
                <span className="text-xs text-muted-foreground">Cargando...</span>
              </div>
            )}
          </div>
        </SidebarContent>
      </SidebarUI>
    );
  }

  return (
    <SidebarUI collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-4 border-b">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5 text-primary-foreground" />
          </div>
          {state !== "collapsed" && (
            <div className="flex flex-col">
              <span className="text-sm font-bold">RetailSnap</span>
              <span className="text-xs text-muted-foreground">Sistema POS</span>
            </div>
          )}
        </div>

        {!hasAnyVisibleItems && !loading && state !== "collapsed" && (
          <div className="p-4 m-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive font-medium mb-2">Sin permisos</p>
            <p className="text-xs text-muted-foreground">
              Contacta al administrador.
            </p>
          </div>
        )}

        {navigationSections.map((section) => {
          const visibleItems = section.items.filter(item => canViewMenuItem(item.href));
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={section.title}>
              {state !== "collapsed" && (
                <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={item.href}
                          end={item.href === "/"}
                          className="hover:bg-sidebar-accent"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        >
                          <item.icon className="h-4 w-4" />
                          {state !== "collapsed" && <span>{item.name}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        <div className="mt-auto border-t p-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {state !== "collapsed" && <span className="ml-2">Cerrar Sesión</span>}
          </Button>
        </div>
      </SidebarContent>
    </SidebarUI>
  );
}
