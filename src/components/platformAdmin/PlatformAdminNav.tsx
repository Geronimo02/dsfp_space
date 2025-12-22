import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Bell,
  MessageSquare,
  FileText,
  BarChart3,
  Settings,
  Ticket,
  Plug,
  Activity,
  Rocket,
  Calculator,
  Package
} from "lucide-react";

interface PlatformAdminNavProps {
  openTicketsCount: number;
  unreadNotificationsCount: number;
}

export function PlatformAdminNav({ openTicketsCount, unreadNotificationsCount }: PlatformAdminNavProps) {
  return (
    <Card className="w-64 flex-shrink-0 h-fit sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Navegación</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <TabsList className="flex flex-col h-auto w-full space-y-1 bg-transparent p-0">
          <TabsTrigger value="companies" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="h-4 w-4" />
            <span>Empresas</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Configuración Precios</span>
          </TabsTrigger>
          <TabsTrigger value="calculator" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Calculator className="h-4 w-4" />
            <span>Calculadora</span>
          </TabsTrigger>
          <TabsTrigger value="module-limits" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Package className="h-4 w-4" />
            <span>Límites de Módulos</span>
          </TabsTrigger>
          <TabsTrigger value="module-audit" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Activity className="h-4 w-4" />
            <span>Auditoría de Módulos</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Métricas</span>
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Rocket className="h-4 w-4" />
            <span>Onboarding</span>
          </TabsTrigger>
          <TabsTrigger value="platform-support" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Ticket className="h-4 w-4" />
            <span>Soporte</span>
            {openTicketsCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {openTicketsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bell className="h-4 w-4" />
            <span>Notificaciones</span>
            {unreadNotificationsCount > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {unreadNotificationsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="feedback" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <MessageSquare className="h-4 w-4" />
            <span>Feedback</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Pagos</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-4 w-4" />
            <span>Usuarios</span>
          </TabsTrigger>
          <TabsTrigger value="plans" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Settings className="h-4 w-4" />
            <span>Planes</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="h-4 w-4" />
            <span>Auditoría</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="w-full justify-start gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Plug className="h-4 w-4" />
            <span>Integraciones</span>
          </TabsTrigger>
        </TabsList>
      </CardContent>
    </Card>
  );
}
