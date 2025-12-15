import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Settings,
  TrendingUp,
  Warehouse,
  DollarSign,
  CreditCard,
  Calculator,
  Truck,
  Calendar,
  Bell,
  BookOpen,
  Lock,
  Activity,
  Zap,
  Target,
  Receipt,
  Building2,
  Wrench,
  Tag,
  Banknote,
  UserCircle,
  BarChart3,
  Shield,
  Plug,
  Sparkles,
  ChevronDown,
  ShoppingBag,
  Store,
  TrendingDown,
  FileCheck,
  AlertCircle,
  PackageSearch,
  ArrowLeftRight,
  PackageOpen,
  UserCheck,
  BadgePercent,
  Search,
  Star,
  PackageCheck,
  LogOut,
  Plus,
} from "lucide-react";
import { useActiveModules } from "@/hooks/useActiveModules";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AvailableModulesDialog } from "./AvailableModulesDialog";

interface NavItem {
  title: string;
  href: string;
  icon: any;
  module?: string;
  permission?: string;
  children?: NavItem[];
  badge?: number;
  favorite?: boolean;
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeModules = useActiveModules();
  const { hasPermission, isAdmin } = usePermissions();
  const { isPlatformAdmin } = usePlatformAdmin();
  
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModulesDialog, setShowModulesDialog] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('sidebar-favorites');
    return saved ? JSON.parse(saved) : ['/pos', '/sales', '/products'];
  });

  // Función para verificar si una ruta pertenece a un grupo
  const isRouteInSection = (sectionHref: string, children?: NavItem[]) => {
    if (!children) return false;
    return children.some(child => location.pathname === child.href || location.pathname.startsWith(child.href + '/'));
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const toggleFavorite = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(prev => {
      const newFavorites = prev.includes(href)
        ? prev.filter(f => f !== href)
        : [...prev, href];
      localStorage.setItem('sidebar-favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  // Helper function to check if module is active
  // Solo platform admins ven todo, los admins de empresa ven solo sus módulos activos
  const hasModule = (moduleName: string) => {
    // Platform admins ven todo para poder navegar y gestionar
    if (isPlatformAdmin) return true;
    
    // Si no hay datos cargados aún, solo mostrar módulos base
    if (!activeModules.data || activeModules.data.length === 0) {
      const baseModules = ['dashboard', 'pos', 'products', 'sales', 'customers', 'settings', 'reports'];
      return baseModules.includes(moduleName);
    }
    
    // Verificar si el código del módulo está en la lista de activos
    // El moduleName viene del item.module en navItems
    return activeModules.data.includes(moduleName);
  };

  const navItems: (NavItem | { section: string; items: NavItem[] })[] = [
    // General
    {
      section: "General",
      items: [
        {
          title: "Dashboard",
          href: "/",
          icon: LayoutDashboard,
          module: "dashboard",
        },
        {
          title: "Punto de Venta",
          href: "/pos",
          icon: ShoppingCart,
          module: "pos",
        },
      ],
    },

    // Ventas
    {
      section: "Ventas",
      items: [
        {
          title: "Ventas",
          href: "/sales",
          icon: FileText,
          module: "sales",
          children: [
            {
              title: "Todas las Ventas",
              href: "/sales",
              icon: FileText,
              module: "sales",
            },
            {
              title: "Presupuestos",
              href: "/quotations",
              icon: FileCheck,
              module: "quotations",
            },
            {
              title: "Remitos",
              href: "/delivery-notes",
              icon: Truck,
              module: "delivery_notes",
            },
            {
              title: "Devoluciones",
              href: "/returns",
              icon: TrendingDown,
              module: "returns",
            },
            {
              title: "Reservas",
              href: "/reservations",
              icon: Calendar,
              module: "reservations",
            },
          ],
        },
      ],
    },

    // Clientes
    {
      section: "Clientes",
      items: [
        {
          title: "Clientes",
          href: "/customers",
          icon: Users,
          module: "customers",
          children: [
            {
              title: "Lista de Clientes",
              href: "/customers",
              icon: Users,
              module: "customers",
            },
            {
              title: "Cuentas Corrientes",
              href: "/accounts-receivable",
              icon: Receipt,
              module: "accounts_receivable",
            },
            {
              title: "Atención al Cliente",
              href: "/customer-support",
              icon: UserCheck,
              module: "customer_support",
            },
          ],
        },
      ],
    },

    // Inventario
    {
      section: "Inventario",
      items: [
        {
          title: "Inventario",
          href: "/products",
          icon: Package,
          module: "products",
          children: [
            {
              title: "Productos",
              href: "/products",
              icon: Package,
              module: "products",
            },
            {
              title: "Alertas de Inventario",
              href: "/inventory-alerts",
              icon: AlertCircle,
              module: "inventory_alerts",
              badge: 5,
            },
            {
              title: "Depósitos",
              href: "/warehouses",
              icon: Warehouse,
              module: "warehouses",
            },
            {
              title: "Stock por Depósito",
              href: "/warehouse-stock",
              icon: PackageSearch,
              module: "warehouse_stock",
            },
            {
              title: "Transferencias",
              href: "/warehouse-transfers",
              icon: ArrowLeftRight,
              module: "warehouse_transfers",
            },
            {
              title: "Reservas de Stock",
              href: "/stock-reservations",
              icon: PackageOpen,
              module: "stock_reservations",
            },
          ],
        },
      ],
    },

    // Compras
    {
      section: "Compras",
      items: [
        {
          title: "Compras",
          href: "/purchases",
          icon: ShoppingBag,
          module: "purchases",
          children: [
            {
              title: "Órdenes de Compra",
              href: "/purchase-orders",
              icon: FileCheck,
              module: "purchase_orders",
            },
            {
              title: "Historial de Compras",
              href: "/purchases",
              icon: ShoppingBag,
              module: "purchases",
            },
            {
              title: "Recepción de Mercadería",
              href: "/purchase-reception",
              icon: PackageCheck,
              module: "purchase_reception",
            },
            {
              title: "Devoluciones a Proveedores",
              href: "/purchase-returns",
              icon: TrendingDown,
              module: "purchase_returns",
            },
            {
              title: "Proveedores",
              href: "/suppliers",
              icon: Truck,
              module: "suppliers",
            },
          ],
        },
      ],
    },

    // Finanzas
    {
      section: "Finanzas",
      items: [
        {
          title: "Finanzas",
          href: "/bank-accounts",
          icon: Building2,
          module: "bank_accounts",
          children: [
            {
              title: "Cuentas Bancarias",
              href: "/bank-accounts",
              icon: Building2,
              module: "bank_accounts",
            },
            {
              title: "Movimientos Bancarios",
              href: "/bank-movements",
              icon: TrendingUp,
              module: "bank_movements",
            },
            {
              title: "Movimientos de Tarjetas",
              href: "/card-movements",
              icon: CreditCard,
              module: "card_movements",
            },
            {
              title: "Retenciones",
              href: "/retentions",
              icon: Calculator,
              module: "retentions",
            },
          ],
        },
      ],
    },

    // Operaciones
    {
      section: "Operaciones",
      items: [
        {
          title: "Servicios Técnicos",
          href: "/technical-services",
          icon: Wrench,
          module: "technical_services",
        },
        {
          title: "Gestión de Caja",
          href: "/cash-register",
          icon: DollarSign,
          module: "cash_register",
        },
        {
          title: "Gastos",
          href: "/expenses",
          icon: Receipt,
          module: "expenses",
        },
        {
          title: "Cheques",
          href: "/checks",
          icon: Banknote,
          module: "checks",
        },
        {
          title: "Promociones",
          href: "/promotions",
          icon: Tag,
          module: "promotions",
        },
      ],
    },

    // RRHH
    {
      section: "RRHH",
      items: [
        {
          title: "Liquidaciones",
          href: "/payroll",
          icon: Calculator,
          module: "payroll",
        },
        {
          title: "Comisiones",
          href: "/commissions",
          icon: BadgePercent,
          module: "commissions",
        },
        {
          title: "Empleados",
          href: "/employees",
          icon: UserCircle,
          module: "employees",
        },
      ],
    },

    // Reportes
    {
      section: "Reportes",
      items: [
        {
          title: "Reportes",
          href: "/reports",
          icon: BarChart3,
          module: "reports",
          children: [
            {
              title: "Reportes",
              href: "/reports",
              icon: BarChart3,
              module: "reports",
            },
            {
              title: "Reportes Contador",
              href: "/accountant-reports",
              icon: BookOpen,
              module: "accountant_reports",
            },
          ],
        },
      ],
    },

    // Administración
    {
      section: "Administración",
      items: [
        {
          title: "Administración",
          href: "/settings",
          icon: Settings,
          permission: "admin",
          children: [
            {
              title: "Configuración",
              href: "/settings",
              icon: Settings,
              module: "settings",
            },
            {
              title: "Puntos de Venta AFIP",
              href: "/pos-points",
              icon: Store,
              module: "pos_afip",
              permission: "admin",
            },
            {
              title: "Auditoría",
              href: "/audit-logs",
              icon: Shield,
              module: "audit_logs",
              permission: "admin",
            },
            {
              title: "Logs de Acceso",
              href: "/access-logs",
              icon: Activity,
              module: "access_logs",
              permission: "admin",
            },
            {
              title: "Cierre Mensual",
              href: "/monthly-closing",
              icon: Lock,
              module: "monthly_closing",
              permission: "admin",
            },
            {
              title: "Operaciones Masivas",
              href: "/bulk-operations",
              icon: Zap,
              module: "bulk_operations",
              permission: "admin",
            },
            {
              title: "Notificaciones",
              href: "/notification-settings",
              icon: Bell,
              module: "notifications",
              permission: "admin",
            },
          ],
        },
      ],
    },

    // Integraciones
    {
      section: "Integraciones",
      items: [
        {
          title: "Integraciones",
          href: "/integrations",
          icon: Plug,
          module: "integrations",
          permission: "admin",
        },
        {
          title: "Facturación AFIP",
          href: "/afip",
          icon: Store,
          module: "afip",
          permission: "admin",
        },
      ],
    },
  ];

  const isNavItemVisible = (item: NavItem) => {
    // Platform admin ve todo
    if (isPlatformAdmin) return true;
    
    // Si tiene módulo, verificar que esté activo
    if (item.module && !hasModule(item.module)) return false;
    
    // Si requiere permiso admin y no lo tiene, ocultar
    if (item.permission === 'admin' && !isAdmin) return false;
    
    return true;
  };

  const renderNavItem = (item: NavItem, isChild = false, isFavoritesList = false) => {
    if (!isNavItemVisible(item)) return null;

    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    const isFavorite = favorites.includes(item.href);

    // Si es un item con children y NO estamos en la lista de favoritos, mostrar collapsible
    if (item.children && !isFavoritesList) {
      const sectionKey = item.href;
      const hasActiveRoute = isRouteInSection(sectionKey, item.children);
      const isOpen = openSections.includes(sectionKey) || hasActiveRoute;
      const hasVisibleChildren = item.children.some(isNavItemVisible);

      if (!hasVisibleChildren) return null;

      return (
        <Collapsible
          key={item.href}
          open={isOpen}
          onOpenChange={() => toggleSection(sectionKey)}
        >
          <CollapsibleTrigger
            className={cn(
              "flex items-center justify-between w-full gap-2 px-3 py-2 text-sm rounded-lg transition-all",
              hasActiveRoute
                ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-medium border-l-2 border-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.title}</span>
              {item.badge && item.badge > 0 && (
                <Badge variant="destructive" className="ml-auto text-[10px] h-5 px-1.5">
                  {item.badge}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform shrink-0",
                isOpen && "transform rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-7 space-y-1 mt-1">
            {item.children.map((child) => renderNavItem(child, true, false))}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link
        key={item.href}
        to={item.href}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all group relative",
          isActive
            ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-medium border-l-2 border-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
          isChild && !isFavoritesList && "pl-3"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate flex-1">{item.title}</span>
        {item.badge && item.badge > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
            {item.badge}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity",
            isFavorite && "opacity-100"
          )}
          onClick={(e) => toggleFavorite(item.href, e)}
        >
          <Star
            className={cn(
              "w-3 h-3",
              isFavorite && "fill-yellow-400 text-yellow-400"
            )}
          />
        </Button>
      </Link>
    );
  };

  // Filtrar items por búsqueda
  const filteredNavItems = useMemo(() => {
    if (!searchQuery) return navItems;
    
    const query = searchQuery.toLowerCase();
    return navItems.map(section => {
      if ("section" in section) {
        const filteredItems = section.items.filter(item => {
          const matchesTitle = item.title.toLowerCase().includes(query);
          const matchesChildren = item.children?.some(child => 
            child.title.toLowerCase().includes(query)
          );
          return matchesTitle || matchesChildren;
        });
        
        return { ...section, items: filteredItems };
      }
      return section;
    }).filter(section => {
      if ("section" in section) {
        return section.items.length > 0;
      }
      return true;
    });
  }, [searchQuery, navItems]);

  // Items favoritos - solo los que el usuario marcó explícitamente
  const favoriteItems = useMemo(() => {
    const allItems: NavItem[] = [];
    navItems.forEach(section => {
      if ("section" in section) {
        section.items.forEach(item => {
          // Si el item tiene hijos, solo agregar los hijos que son favoritos
          if (item.children) {
            item.children.forEach(child => {
              if (favorites.includes(child.href)) {
                allItems.push(child);
              }
            });
          } else {
            // Si no tiene hijos, agregarlo si es favorito
            if (favorites.includes(item.href)) {
              allItems.push(item);
            }
          }
        });
      }
    });
    return allItems;
  }, [favorites, navItems]);

  return (
    <div className="flex flex-col h-full border-r bg-gradient-to-b from-sidebar to-sidebar/95">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-lg font-bold text-foreground">RetailSnap</span>
            <p className="text-[10px] text-muted-foreground">Sistema POS</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar módulo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-sidebar-accent/50 border-sidebar-accent"
          />
        </div>
      </div>

      {/* Favorites Section */}
      {favoriteItems.length > 0 && !searchQuery && (
        <div className="px-3 pt-3 pb-2 border-b">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            Favoritos
          </h3>
          <div className="space-y-1">
            {favoriteItems.map((item) => renderNavItem(item, false, true))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6 scrollbar-thin scrollbar-thumb-sidebar-accent scrollbar-track-transparent">
        {filteredNavItems.map((section) => {
          if ("section" in section) {
            const visibleItems = section.items.filter(isNavItemVisible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.section}>
                <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.section}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => renderNavItem(item))}
                </div>
              </div>
            );
          }
          return null;
        })}
      </nav>

      {/* Botón + Funcionalidades - Solo visible si no es platform admin */}
      {!isPlatformAdmin && (
        <div className="px-3 pb-2">
          <Button
            onClick={() => setShowModulesDialog(true)}
            variant="outline"
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg border-dashed border-primary/50 text-primary hover:bg-primary/5 hover:border-primary transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">Más Funcionalidades</span>
          </Button>
        </div>
      )}

      {/* AI Assistant - Botón especial al final */}
      <div className="p-3 border-t bg-gradient-to-r from-sidebar to-sidebar/95 space-y-2">
        <Link
          to="/ai-assistant"
          className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
        >
          <Sparkles className="w-4 h-4" />
          <span className="font-semibold">Asistente IA</span>
        </Link>
        
        <Button
          onClick={async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              toast.error("Error al cerrar sesión");
              console.error(error);
            } else {
              toast.success("Sesión cerrada correctamente");
              navigate("/auth");
            }
          }}
          variant="outline"
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Cerrar Sesión</span>
        </Button>
      </div>

      {/* Dialog de módulos disponibles */}
      <AvailableModulesDialog
        open={showModulesDialog}
        onOpenChange={setShowModulesDialog}
        activeModules={activeModules.data || []}
      />
    </div>
  );
}
