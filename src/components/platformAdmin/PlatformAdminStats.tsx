import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, 
  CheckCircle2,
  Bell,
  MessageSquare,
  DollarSign,
  Clock
} from "lucide-react";

interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  unreadNotifications: number;
  pendingFeedback: number;
  totalRevenue: number;
  pendingRevenue: number;
}

interface PlatformAdminStatsProps {
  stats: PlatformStats | undefined;
}

export function PlatformAdminStats({ stats }: PlatformAdminStatsProps) {
  if (!stats) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Empresas</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCompanies}</div>
          <p className="text-xs text-muted-foreground">
            {stats.activeCompanies} activas
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Empresas Activas</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeCompanies}</div>
          <p className="text-xs text-muted-foreground">
            {stats.totalCompanies > 0 
              ? Math.round((stats.activeCompanies / stats.totalCompanies) * 100) 
              : 0}% del total
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Notificaciones</CardTitle>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.unreadNotifications}</div>
          <p className="text-xs text-muted-foreground">
            Sin leer
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Feedback Pendiente</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingFeedback}</div>
          <p className="text-xs text-muted-foreground">
            Requiere atención
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Cobrado
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendiente</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${stats.pendingRevenue.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            Por cobrar
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
