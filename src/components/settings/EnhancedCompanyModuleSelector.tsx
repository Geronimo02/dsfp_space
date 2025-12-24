import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Check, 
  Package, 
  AlertTriangle, 
  Clock, 
  Edit, 
  Settings, 
  TrendingUp,
  CheckCircle2,
  XCircle,
  Pause
} from "lucide-react";
import { 
  activateModule, 
  deactivateModule, 
  upgradeModule,
  validateModuleDependencies 
} from "@/integrations/supabase/modules";
import { ModuleStatus, ModuleLimits } from "@/integrations/supabase/types.modules";

interface EnhancedCompanyModuleSelectorProps {
  companyId: string;
}

export function EnhancedCompanyModuleSelector({ companyId }: EnhancedCompanyModuleSelectorProps) {
  const queryClient = useQueryClient();
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [activationOptions, setActivationOptions] = useState({
    is_trial: false,
    trial_days: 30,
    reason: ''
  });

  // Fetch all modules
  const { data: allModules } = useQuery({
    queryKey: ['platform_modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_modules')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch company modules with status
  const { data: companyModules, isLoading } = useQuery({
    queryKey: ['company_modules_enhanced', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_modules')
        .select(`
          *,
          module:platform_modules(*)
        `)
        .eq('company_id', companyId);
      
      if (error) throw error;
      return data;
    }
  });

  // Activate module mutation
  const activateMutation = useMutation({
    mutationFn: async ({ moduleId, options }: { moduleId: string; options: any }) => {
      // Validate dependencies first
      const validation = await validateModuleDependencies(
        companyId,
        moduleId
      );

      if (!validation.valid) {
        throw new Error(validation.error_message || 'Dependency validation failed');
      }

      return activateModule({
        company_id: companyId,
        module_id: moduleId,
        ...options
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_modules_enhanced', companyId] });
      queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
      queryClient.invalidateQueries({ queryKey: ['activeModules'] });
      toast.success('Módulo activado correctamente');
      setActivationDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al activar módulo');
    }
  });

  // Deactivate module mutation
  const deactivateMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      return deactivateModule({
        company_id: companyId,
        module_id: moduleId,
        immediate: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_modules_enhanced', companyId] });
      queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
      queryClient.invalidateQueries({ queryKey: ['activeModules'] });
      toast.success('Módulo desactivado correctamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al desactivar módulo');
    }
  });

  // Convert trial to paid mutation
  const convertTrialMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      return upgradeModule({
        company_id: companyId,
        module_id: moduleId,
        from_status: 'trial',
        to_status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_modules_enhanced', companyId] });
      queryClient.invalidateQueries({ queryKey: ['companyModules', companyId] });
      queryClient.invalidateQueries({ queryKey: ['activeModules'] });
      toast.success('Trial convertido a pago correctamente');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al convertir trial');
    }
  });

  const handleActivateClick = (module: any) => {
    setSelectedModule(module);
    setActivationOptions({
      is_trial: false,
      trial_days: 30,
      reason: ''
    });
    setActivationDialogOpen(true);
  };

  const handleActivate = () => {
    if (!selectedModule) return;
    
    activateMutation.mutate({
      moduleId: selectedModule.id,
      options: activationOptions
    });
  };

  const handleDeactivate = (moduleId: string) => {
    if (window.confirm('¿Está seguro que desea desactivar este módulo?')) {
      deactivateMutation.mutate(moduleId);
    }
  };

  const handleConvertTrial = (moduleId: string) => {
    if (window.confirm('¿Desea convertir este trial a módulo pago?')) {
      convertTrialMutation.mutate(moduleId);
    }
  };

  const getStatusBadge = (status?: ModuleStatus, isTrial?: boolean) => {
    if (isTrial) {
      return <Badge variant="secondary" className="bg-purple-100 text-purple-700">Trial</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-700">Activo</Badge>;
      case 'suspended':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Suspendido</Badge>;
      case 'pending_payment':
        return <Badge variant="destructive" className="bg-yellow-100 text-yellow-700">Pago Pendiente</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expirado</Badge>;
      default:
        return <Badge variant="outline">Inactivo</Badge>;
    }
  };

  const getTrialDaysRemaining = (trialEndsAt?: string | null) => {
    if (!trialEndsAt) return null;
    const now = new Date();
    const endsAt = new Date(trialEndsAt);
    const daysRemaining = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  };

  const activeModuleIds = companyModules?.map(cm => cm.module_id) || [];
  const baseModules = allModules?.filter(m => m.is_base_module) || [];
  const additionalModules = allModules?.filter(m => !m.is_base_module) || [];

  if (isLoading) {
    return <div>Cargando módulos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Active Modules Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Módulos Activos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {companyModules?.filter(cm => cm.active && cm.status === 'active').length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Activos</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {companyModules?.filter(cm => cm.is_trial).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">En Trial</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {companyModules?.filter(cm => cm.status === 'pending_payment').length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Pago Pendiente</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">
                {companyModules?.filter(cm => !cm.active).length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Inactivos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Módulos</CardTitle>
          <CardDescription>
            Configure qué módulos están activos para esta empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Trial</TableHead>
                <TableHead>Activado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Base Modules */}
              {baseModules.map(module => {
                const companyModule = companyModules?.find(cm => cm.module_id === module.id);
                
                return (
                  <TableRow key={module.id} className="bg-blue-50/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="font-medium">{module.name}</div>
                          <div className="text-sm text-muted-foreground">{module.code}</div>
                        </div>
                        <Badge variant="secondary" className="ml-2">Base</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-blue-100 text-blue-700">
                        Incluido
                      </Badge>
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      Siempre activo
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Additional Modules */}
              {additionalModules.map(module => {
                const companyModule = companyModules?.find(cm => cm.module_id === module.id);
                const isActive = companyModule?.active;
                const trialDays = companyModule?.trial_ends_at 
                  ? getTrialDaysRemaining(companyModule.trial_ends_at)
                  : null;

                return (
                  <TableRow key={module.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{module.name}</div>
                          <div className="text-sm text-muted-foreground">{module.code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(companyModule?.status as ModuleStatus, companyModule?.is_trial)}
                    </TableCell>
                    <TableCell>
                      {companyModule?.is_trial && trialDays !== null ? (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium">
                            {trialDays} días restantes
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {companyModule?.activated_at ? (
                        <div className="text-sm">
                          {new Date(companyModule.activated_at).toLocaleDateString('es-AR')}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isActive ? (
                          <Button
                            size="sm"
                            onClick={() => handleActivateClick(module)}
                            disabled={activateMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Activar
                          </Button>
                        ) : (
                          <>
                            {companyModule?.is_trial && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConvertTrial(module.id)}
                                disabled={convertTrialMutation.isPending}
                              >
                                <TrendingUp className="h-4 w-4 mr-1" />
                                Convertir a Pago
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeactivate(module.id)}
                              disabled={deactivateMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Desactivar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Activation Dialog */}
      <Dialog open={activationDialogOpen} onOpenChange={setActivationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar Módulo: {selectedModule?.name}</DialogTitle>
            <DialogDescription>
              Configure las opciones de activación para este módulo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_trial"
                checked={activationOptions.is_trial}
                onCheckedChange={(checked) => 
                  setActivationOptions({ ...activationOptions, is_trial: checked })
                }
              />
              <Label htmlFor="is_trial">Activar como período de prueba (Trial)</Label>
            </div>

            {activationOptions.is_trial && (
              <div className="space-y-2">
                <Label htmlFor="trial_days">Días de prueba</Label>
                <Input
                  id="trial_days"
                  type="number"
                  value={activationOptions.trial_days}
                  onChange={(e) => 
                    setActivationOptions({ 
                      ...activationOptions, 
                      trial_days: parseInt(e.target.value) || 30 
                    })
                  }
                  min={1}
                  max={90}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Razón (opcional)</Label>
              <Textarea
                id="reason"
                value={activationOptions.reason}
                onChange={(e) => 
                  setActivationOptions({ ...activationOptions, reason: e.target.value })
                }
                placeholder="Ingrese la razón de la activación..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActivationDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleActivate}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending ? 'Activando...' : 'Activar Módulo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
