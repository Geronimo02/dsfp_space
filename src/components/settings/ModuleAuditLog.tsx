import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  AlertTriangle
} from "lucide-react";
import { formatDate } from "@/lib/exportUtils";
import { ModuleChangeHistory, ModuleChangeAction } from "@/integrations/supabase/types.modules";

export function ModuleAuditLog() {
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch audit history
  const { data: auditHistory, isLoading } = useQuery({
    queryKey: ['module_change_history', companyFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('module_change_history')
        .select(`
          *,
          companies:company_id (name),
          platform_modules:module_id (name, code)
        `)
        .order('changed_at', { ascending: false })
        .limit(200);

      if (companyFilter !== 'all') {
        query = query.eq('company_id', companyFilter);
      }

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as any[];
    }
  });

  // Fetch companies for filter
  const { data: companies } = useQuery({
    queryKey: ['companies_for_audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  const getActionIcon = (action: ModuleChangeAction) => {
    switch (action) {
      case 'activated':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'deactivated':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'upgraded':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'downgraded':
        return <TrendingDown className="h-4 w-4 text-orange-500" />;
      case 'trial_started':
        return <Clock className="h-4 w-4 text-purple-500" />;
      case 'trial_ended':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionBadge = (action: ModuleChangeAction) => {
    const variants = {
      activated: 'default',
      deactivated: 'destructive',
      upgraded: 'default',
      downgraded: 'secondary',
      trial_started: 'secondary',
      trial_ended: 'outline'
    } as const;

    const labels = {
      activated: 'Activado',
      deactivated: 'Desactivado',
      upgraded: 'Mejorado',
      downgraded: 'Degradado',
      trial_started: 'Trial Iniciado',
      trial_ended: 'Trial Finalizado'
    };

    return (
      <Badge variant={variants[action] || 'default'}>
        {labels[action] || action}
      </Badge>
    );
  };

  const filteredHistory = auditHistory?.filter(entry => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      entry.companies?.name?.toLowerCase().includes(search) ||
      entry.platform_modules?.name?.toLowerCase().includes(search) ||
      entry.platform_modules?.code?.toLowerCase().includes(search) ||
      entry.reason?.toLowerCase().includes(search)
    );
  });

  if (isLoading) {
    return <div>Cargando historial de auditoría...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Auditoría de Cambios en Módulos
        </CardTitle>
        <CardDescription>
          Historial completo de activaciones, desactivaciones y cambios en módulos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              placeholder="Buscar por empresa, módulo o razón..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="w-[200px]">
            <Label htmlFor="company">Empresa</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger id="company">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las empresas</SelectItem>
                {companies?.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[200px]">
            <Label htmlFor="action">Acción</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger id="action">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="activated">Activados</SelectItem>
                <SelectItem value="deactivated">Desactivados</SelectItem>
                <SelectItem value="upgraded">Mejorados</SelectItem>
                <SelectItem value="trial_started">Trial Iniciado</SelectItem>
                <SelectItem value="trial_ended">Trial Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Audit Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Precios</TableHead>
                <TableHead>Razón</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No se encontraron registros
                  </TableCell>
                </TableRow>
              ) : (
                filteredHistory?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm">
                        {formatDate(entry.changed_at)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.changed_at).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {entry.companies?.name || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {entry.platform_modules?.name || 'N/A'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.platform_modules?.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(entry.action)}
                        {getActionBadge(entry.action)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.previous_price !== null || entry.new_price !== null ? (
                        <div className="text-sm">
                          {entry.previous_price !== null && (
                            <div className="text-muted-foreground line-through">
                              ${entry.previous_price}
                            </div>
                          )}
                          {entry.new_price !== null && (
                            <div className="font-medium">
                              ${entry.new_price}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.reason ? (
                        <div className="text-sm max-w-xs truncate" title={entry.reason}>
                          {entry.reason}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
                        <div className="text-xs">
                          {Object.entries(entry.metadata).map(([key, value]) => (
                            <div key={key} className="text-muted-foreground">
                              <span className="font-medium">{key}:</span> {String(value)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary Stats */}
        {filteredHistory && filteredHistory.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total de Cambios</div>
              <div className="text-2xl font-bold">{filteredHistory.length}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Activaciones</div>
              <div className="text-2xl font-bold text-green-600">
                {filteredHistory.filter(e => e.action === 'activated').length}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Desactivaciones</div>
              <div className="text-2xl font-bold text-red-600">
                {filteredHistory.filter(e => e.action === 'deactivated').length}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Trials Activos</div>
              <div className="text-2xl font-bold text-purple-600">
                {filteredHistory.filter(e => e.action === 'trial_started').length}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
