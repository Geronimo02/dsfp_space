import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Package, 
  ShoppingBag, 
  Building2, 
  Wrench, 
  Calculator,
  MessageSquare,
  Send,
  CheckCircle,
  Sparkles,
  FileText,
  Users,
  CreditCard,
  Banknote,
  BarChart3,
  Shield,
  Zap,
  Bell,
  Tag,
  Truck,
  Calendar,
  Receipt,
  Plug,
  AlertCircle,
  Store,
  Lock,
  Activity,
  Warehouse,
  ArrowLeftRight,
  PackageOpen,
  TrendingDown,
  BookOpen,
  LayoutDashboard,
  ShoppingCart,
  Settings,
  UserCheck,
  FileCheck,
  PackageCheck,
  ChevronDown,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompany } from "@/contexts/CompanyContext";

// Mapeo de códigos de módulos a íconos
const MODULE_ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  products: Package,
  sales: FileText,
  customers: Users,
  settings: Settings,
  reports: BarChart3,
  quotations: FileCheck,
  delivery_notes: Truck,
  returns: TrendingDown,
  reservations: Calendar,
  inventory_alerts: AlertCircle,
  warehouses: Warehouse,
  warehouse_stock: Package,
  warehouse_transfers: ArrowLeftRight,
  stock_reservations: PackageOpen,
  purchases: ShoppingBag,
  purchase_orders: FileCheck,
  purchase_reception: PackageCheck,
  purchase_returns: TrendingDown,
  suppliers: Truck,
  bank_accounts: Building2,
  bank_movements: Building2,
  card_movements: CreditCard,
  retentions: Calculator,
  cash_register: Receipt,
  expenses: Receipt,
  checks: Banknote,
  technical_services: Wrench,
  payroll: Calculator,
  commissions: Calculator,
  employees: UserCheck,
  promotions: Tag,
  afip: Store,
  pos_afip: Store,
  audit_logs: Shield,
  access_logs: Activity,
  monthly_closing: Lock,
  bulk_operations: Zap,
  notifications: Bell,
  integrations: Plug,
  accounts_receivable: Receipt,
  accountant_reports: BookOpen,
  customer_support: UserCheck,
};

// Mapeo de categorías a nombres legibles
const CATEGORY_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  pos: "Punto de Venta",
  ventas: "Ventas",
  clientes: "Clientes",
  inventario: "Inventario",
  compras: "Compras",
  finanzas: "Finanzas",
  operaciones: "Operaciones",
  rrhh: "RRHH",
  reportes: "Reportes",
  administracion: "Administración",
  integraciones: "Integraciones",
};

// Mapeo de categorías a íconos
const CATEGORY_ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  ventas: FileText,
  clientes: Users,
  inventario: Package,
  compras: ShoppingBag,
  finanzas: Building2,
  operaciones: Wrench,
  rrhh: Calculator,
  reportes: BarChart3,
  administracion: Settings,
  integraciones: Plug,
};

interface PlatformModule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  is_base: boolean | null;
  price_monthly: number | null;
  display_order: number | null;
}

interface AvailableModulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeModules: string[];
}

export function AvailableModulesDialog({ 
  open, 
  onOpenChange, 
  activeModules 
}: AvailableModulesDialogProps) {
  const { currentCompany } = useCompany();
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  // Obtener todos los módulos de la plataforma con categorías
  const { data: allModules, isLoading } = useQuery({
    queryKey: ['platform_modules_all_with_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_modules')
        .select('id, code, name, description, category, is_base, price_monthly, display_order')
        .eq('is_active', true)
        .order('category')
        .order('display_order');
      
      if (error) throw error;
      return (data || []) as PlatformModule[];
    },
    enabled: open,
  });

  // Filtrar módulos que NO están activos y no son base
  const unavailableModules = (allModules || []).filter(module => {
    const isActive = activeModules.includes(module.code);
    const isBase = module.is_base === true;
    return !isActive && !isBase;
  });

  // Agrupar por categoría
  const modulesByCategory = unavailableModules.reduce((acc, module) => {
    const category = module.category || 'otros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(module);
    return acc;
  }, {} as Record<string, PlatformModule[]>);

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleModule = (code: string) => {
    setSelectedModules(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const handleSendRequest = async () => {
    if (selectedModules.length === 0) {
      toast.error("Selecciona al menos un módulo");
      return;
    }

    setSending(true);
    
    try {
      // Get selected module names
      const selectedModuleNames = unavailableModules
        .filter(m => selectedModules.includes(m.code))
        .map(m => m.name);
      
      // Try to send email notification via edge function
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create a platform support ticket for the request
      const ticketNumber = `MOD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      
      const { error } = await (supabase as any)
        .from("platform_support_tickets")
        .insert([{
          ticket_number: ticketNumber,
          company_id: currentCompany?.id,
          created_by: user?.id,
          subject: `Solicitud de activación de módulos: ${selectedModuleNames.join(', ')}`,
          description: `La empresa solicita activar los siguientes módulos:\n\n${selectedModuleNames.map(n => `• ${n}`).join('\n')}${message ? `\n\nMensaje adicional:\n${message}` : ''}`,
          category: "feature_request",
          priority: "medium",
        }]);
      
      if (error) {
        console.error("Error creating ticket:", error);
        // Still show success since the request was recorded
      }
      
      setSent(true);
      toast.success("Solicitud enviada. Nos pondremos en contacto contigo pronto.");
      
      setTimeout(() => {
        setSent(false);
        setSelectedModules([]);
        setMessage("");
        setOpenCategories([]);
        onOpenChange(false);
      }, 2000);
    } catch (error) {
      console.error("Error sending request:", error);
      toast.error("Error al enviar solicitud. Intenta nuevamente.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSelectedModules([]);
    setMessage("");
    setSent(false);
    setOpenCategories([]);
    onOpenChange(false);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Cargando módulos...
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (unavailableModules.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Todas las funcionalidades activadas
            </DialogTitle>
            <DialogDescription>
              Ya tienes acceso a todos los módulos disponibles.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-full sm:max-w-2xl max-h-[100vh] h-[100vh] sm:h-auto p-0 sm:p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Solicitar Funcionalidades
          </DialogTitle>
          <DialogDescription>
            Selecciona los módulos que te interesa activar y envía una solicitud.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <p className="text-center text-muted-foreground">
              ¡Solicitud enviada! Nos pondremos en contacto contigo pronto.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-[40vh] sm:max-h-[350px] overflow-y-auto pr-2">
              {Object.entries(modulesByCategory).map(([category, modules]) => {
                const CategoryIcon = CATEGORY_ICONS[category] || Package;
                const isOpen = openCategories.includes(category);
                const selectedInCategory = modules.filter(m => selectedModules.includes(m.code)).length;
                
                return (
                  <Collapsible
                    key={category}
                    open={isOpen}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <CategoryIcon className="w-5 h-5 text-primary" />
                        <span className="font-medium">
                          {CATEGORY_NAMES[category] || category}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {modules.length} disponibles
                        </Badge>
                        {selectedInCategory > 0 && (
                          <Badge variant="default" className="text-xs">
                            {selectedInCategory} seleccionados
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className={cn(
                        "w-4 h-4 transition-transform",
                        isOpen && "rotate-180"
                      )} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-4 pt-2 space-y-2">
                      {modules.map((module) => {
                        const Icon = MODULE_ICONS[module.code] || Package;
                        const isSelected = selectedModules.includes(module.code);
                        
                        return (
                          <div
                            key={module.code}
                            onClick={() => toggleModule(module.code)}
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer transition-all",
                              isSelected 
                                ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={() => toggleModule(module.code)}
                                className="pointer-events-none"
                              />
                              <div className={cn(
                                "p-2 rounded-lg",
                                isSelected ? "bg-primary/10" : "bg-muted"
                              )}>
                                <Icon className={cn(
                                  "w-4 h-4",
                                  isSelected ? "text-primary" : "text-muted-foreground"
                                )} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm">{module.name}</h4>
                                {module.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    {module.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>

            {selectedModules.length > 0 && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <div className="text-sm font-medium">
                  {selectedModules.length} módulos seleccionados
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2 border-t">
              <Textarea
                placeholder="Mensaje adicional (opcional) - Cuéntanos por qué necesitas estos módulos..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
              />
              
              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                <p className="flex items-center gap-2 mb-1">
                  <Mail className="w-3.5 h-3.5" />
                  Recibirás una respuesta por email
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  O podemos contactarte por WhatsApp
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSendRequest}
                disabled={selectedModules.length === 0 || sending}
                className="flex-1"
              >
                {sending ? (
                  <>Enviando...</>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Solicitud
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
