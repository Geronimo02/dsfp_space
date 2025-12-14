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
  Settings
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// Mapeo de códigos de módulos a íconos
const MODULE_ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  products: Package,
  sales: FileText,
  customers: Users,
  settings: Settings,
  reports: BarChart3,
  quotations: FileText,
  delivery_notes: Truck,
  returns: TrendingDown,
  reservations: Calendar,
  inventory_alerts: AlertCircle,
  warehouses: Warehouse,
  warehouse_stock: Package,
  warehouse_transfers: ArrowLeftRight,
  stock_reservations: PackageOpen,
  purchases: ShoppingBag,
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
  promotions: Tag,
  afip: Store,
  afip_pos_points: Store,
  audit_logs: Shield,
  access_logs: Activity,
  monthly_closing: Lock,
  bulk_operations: Zap,
  notifications: Bell,
  integrations: Plug,
  accounts_receivable: Receipt,
  accountant_reports: BookOpen,
  advanced_reports: BarChart3,
  ai_assistant: Sparkles,
};

// Módulos base que siempre están activos y no se muestran como disponibles
const BASE_MODULES = ['dashboard', 'pos', 'products', 'sales', 'customers', 'settings', 'reports'];

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
  const [showContactForm, setShowContactForm] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Obtener todos los módulos de la plataforma
  const { data: allModules, isLoading } = useQuery({
    queryKey: ['platform_modules_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_modules')
        .select('id, code, name, description')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      console.log('[AvailableModulesDialog] All platform modules:', data?.length);
      return data || [];
    },
    enabled: open,
  });

  // Filtrar módulos que NO están activos para la empresa actual y no son base
  const unavailableModules = (allModules || []).filter(module => {
    const isActive = activeModules.includes(module.code);
    const isBase = BASE_MODULES.includes(module.code);
    return !isActive && !isBase;
  });
  
  console.log('[AvailableModulesDialog] Active modules from company:', activeModules);
  console.log('[AvailableModulesDialog] Unavailable modules to show:', unavailableModules.length);

  const toggleModule = (code: string) => {
    setSelectedModules(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const handleContactSupport = async () => {
    if (selectedModules.length === 0) {
      toast.error("Selecciona al menos un módulo");
      return;
    }

    setSending(true);
    // Simular envío - aquí se integraría con el sistema de tickets
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSending(false);
    setSent(true);
    toast.success("Solicitud enviada correctamente");
    
    // Reset después de un tiempo
    setTimeout(() => {
      setSent(false);
      setShowContactForm(false);
      setSelectedModules([]);
      setMessage("");
      onOpenChange(false);
    }, 2000);
  };

  const handleClose = () => {
    setShowContactForm(false);
    setSelectedModules([]);
    setMessage("");
    setSent(false);
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
              <Skeleton key={i} className="h-20 w-full" />
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Funcionalidades Adicionales
          </DialogTitle>
          <DialogDescription>
            Mejora tu plan con estas funcionalidades. Selecciona las que te interesen y contacta con soporte.
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
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {unavailableModules.map((module) => {
                const Icon = MODULE_ICONS[module.code] || Package;
                const isSelected = selectedModules.includes(module.code);
                
                return (
                  <div
                    key={module.code}
                    onClick={() => toggleModule(module.code)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{module.name}</h4>
                          {isSelected && (
                            <Badge variant="default" className="text-xs">
                              Seleccionado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {module.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {showContactForm && (
              <div className="space-y-3 pt-3 border-t">
                <Textarea
                  placeholder="Mensaje adicional (opcional)..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {!showContactForm ? (
                <Button
                  onClick={() => setShowContactForm(true)}
                  disabled={selectedModules.length === 0}
                  className="flex-1"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Contactar Soporte ({selectedModules.length} seleccionados)
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowContactForm(false)}
                    className="flex-1"
                  >
                    Volver
                  </Button>
                  <Button
                    onClick={handleContactSupport}
                    disabled={sending}
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
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
