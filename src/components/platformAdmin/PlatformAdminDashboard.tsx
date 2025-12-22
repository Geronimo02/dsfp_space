import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  CheckCircle2,
  Bell,
  MessageSquare,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Ticket,
  Users,
  AlertCircle
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  unreadNotifications: number;
  pendingFeedback: number;
  totalRevenue: number;
  pendingRevenue: number;
}

interface RevenueData {
  month: string;
  revenue: number;
}

interface TicketStats {
  open: number;
  inProgress: number;
  resolved: number;
  slaBreach: number;
}

interface PlatformAdminDashboardProps {
  stats: PlatformStats | undefined;
  revenueData: RevenueData[] | undefined;
  ticketStats: TicketStats;
  companiesGrowth?: number;
  usersCount?: number;
  overduePayments?: number;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

export function PlatformAdminDashboard({ 
  stats, 
  revenueData, 
  ticketStats,
  companiesGrowth = 0,
  usersCount = 0,
  overduePayments = 0
}: PlatformAdminDashboardProps) {
  if (!stats) return null;

  const pieData = [
    { name: 'Resueltos', value: ticketStats.resolved, color: '#22c55e' },
    { name: 'En Progreso', value: ticketStats.inProgress, color: '#3b82f6' },
    { name: 'Abiertos', value: ticketStats.open, color: '#f59e0b' },
    { name: 'SLA Breach', value: ticketStats.slaBreach, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const hasAlerts = ticketStats.slaBreach > 0 || overduePayments > 0 || stats.unreadNotifications > 5;

  return (
    <div className="space-y-6">
      {/* Alertas Críticas */}
      {hasAlerts && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Alertas que Requieren Atención
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {ticketStats.slaBreach > 0 && (
                <Badge variant="destructive" className="text-sm py-1 px-3">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {ticketStats.slaBreach} SLA incumplido{ticketStats.slaBreach > 1 ? 's' : ''}
                </Badge>
              )}
              {overduePayments > 0 && (
                <Badge variant="destructive" className="text-sm py-1 px-3">
                  <Clock className="h-4 w-4 mr-2" />
                  {overduePayments} pago{overduePayments > 1 ? 's' : ''} vencido{overduePayments > 1 ? 's' : ''}
                </Badge>
              )}
              {stats.unreadNotifications > 5 && (
                <Badge variant="secondary" className="text-sm py-1 px-3">
                  <Bell className="h-4 w-4 mr-2" />
                  {stats.unreadNotifications} notificaciones sin leer
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards - Resumen Ejecutivo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
            <div className="flex items-center gap-1 text-xs">
              {companiesGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={companiesGrowth >= 0 ? "text-green-500" : "text-red-500"}>
                {companiesGrowth >= 0 ? '+' : ''}{companiesGrowth}%
              </span>
              <span className="text-muted-foreground">este mes</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeCompanies}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalCompanies > 0 
                ? Math.round((stats.activeCompanies / stats.totalCompanies) * 100) 
                : 0}% del total
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersCount}</div>
            <p className="text-xs text-muted-foreground">
              Activos en plataforma
            </p>
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets Abiertos</CardTitle>
            <Ticket className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{ticketStats.open}</div>
            <p className="text-xs text-muted-foreground">
              {ticketStats.inProgress} en progreso
            </p>
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats.totalRevenue.toLocaleString('es-AR')}
            </div>
            <p className="text-xs text-muted-foreground">
              Cobrado este mes
            </p>
          </CardContent>
        </Card>
        
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Cobrar</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              ${stats.pendingRevenue.toLocaleString('es-AR')}
            </div>
            <p className="text-xs text-muted-foreground">
              {overduePayments > 0 && <span className="text-red-500">{overduePayments} vencidos</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico de Ingresos */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Tendencia de Ingresos</CardTitle>
            <CardDescription>Ingresos mensuales de la plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData && revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toLocaleString('es-AR')}`, 'Ingresos']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                <p>No hay datos de ingresos disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Tickets */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Estado de Tickets</CardTitle>
            <CardDescription>Distribución de tickets de soporte</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              {pieData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string) => [value, name]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {pieData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm text-muted-foreground">{entry.name}</span>
                        <span className="text-sm font-medium">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[180px] text-muted-foreground">
                  <div className="text-center">
                    <Ticket className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Sin tickets activos</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
