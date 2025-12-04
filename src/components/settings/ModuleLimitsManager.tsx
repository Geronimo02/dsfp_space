import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Edit, Save, X, Package, Users, FileText, Database } from "lucide-react";
import { PlatformModuleExtended, ModuleLimits } from "@/integrations/supabase/types.modules";
import { Textarea } from "@/components/ui/textarea";

export function ModuleLimitsManager() {
  const queryClient = useQueryClient();
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<PlatformModuleExtended | null>(null);
  const [limits, setLimits] = useState<ModuleLimits>({});
  const [dependencies, setDependencies] = useState({
    required_modules: [] as string[],
    incompatible_with: [] as string[]
  });

  // Fetch all modules
  const { data: modules, isLoading } = useQuery({
    queryKey: ['platform_modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_modules')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data as PlatformModuleExtended[];
    }
  });

  // Update module mutation
  const updateModuleMutation = useMutation({
    mutationFn: async ({ 
      moduleId, 
      limits, 
      dependencies 
    }: { 
      moduleId: string; 
      limits: ModuleLimits;
      dependencies: any;
    }) => {
      const { error } = await supabase
        .from('platform_modules')
        .update({ 
          limits: limits as any,
          dependencies: dependencies as any
        })
        .eq('id', moduleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_modules'] });
      toast.success('Límites actualizados correctamente');
      setEditDialogOpen(false);
      setSelectedModule(null);
    },
    onError: (error) => {
      toast.error(`Error al actualizar: ${error.message}`);
    }
  });

  const handleEditModule = (module: PlatformModuleExtended) => {
    setSelectedModule(module);
    setLimits(module.limits || {});
    setDependencies({
      required_modules: (module.dependencies as any)?.required_modules || [],
      incompatible_with: (module.dependencies as any)?.incompatible_with || []
    });
    setEditDialogOpen(true);
  };

  const handleSaveModule = () => {
    if (!selectedModule) return;
    
    updateModuleMutation.mutate({
      moduleId: selectedModule.id,
      limits,
      dependencies
    });
  };

  const formatFeatures = (features?: string[]) => {
    if (!features || features.length === 0) return '-';
    return features.join(', ');
  };

  if (isLoading) {
    return <div>Cargando módulos...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Límites por Módulo</CardTitle>
          <CardDescription>
            Configure los límites y restricciones para cada módulo disponible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Límites Configurados</TableHead>
                <TableHead>Dependencias</TableHead>
                <TableHead>Features</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modules?.map((module) => {
                const moduleLimits = module.limits || {};
                const moduleDeps = module.dependencies as any || {};
                
                return (
                  <TableRow key={module.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{module.name}</div>
                          <div className="text-sm text-muted-foreground">{module.code}</div>
                        </div>
                        {module.is_base_module && (
                          <Badge variant="secondary">Base</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {moduleLimits.max_products && (
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            <span>{moduleLimits.max_products} productos</span>
                          </div>
                        )}
                        {moduleLimits.max_users && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{moduleLimits.max_users} usuarios</span>
                          </div>
                        )}
                        {moduleLimits.max_invoices_per_month && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span>{moduleLimits.max_invoices_per_month} facturas/mes</span>
                          </div>
                        )}
                        {moduleLimits.max_storage_mb && (
                          <div className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            <span>{moduleLimits.max_storage_mb} MB</span>
                          </div>
                        )}
                        {Object.keys(moduleLimits).length === 0 && (
                          <span className="text-muted-foreground">Sin límites</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {moduleDeps.required_modules?.length > 0 && (
                          <div>
                            <Badge variant="outline" className="mb-1">
                              Requiere:
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {moduleDeps.required_modules.join(', ')}
                            </div>
                          </div>
                        )}
                        {moduleDeps.incompatible_with?.length > 0 && (
                          <div>
                            <Badge variant="destructive" className="mb-1">
                              Incompatible:
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {moduleDeps.incompatible_with.join(', ')}
                            </div>
                          </div>
                        )}
                        {!moduleDeps.required_modules?.length && 
                         !moduleDeps.incompatible_with?.length && (
                          <span className="text-muted-foreground">Sin dependencias</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {moduleLimits.features && moduleLimits.features.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {moduleLimits.features.slice(0, 2).map((feature, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                            {moduleLimits.features.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{moduleLimits.features.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditModule(module)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Module Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Límites: {selectedModule?.name}</DialogTitle>
            <DialogDescription>
              Establezca los límites y dependencias para este módulo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Limits Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Límites de Uso</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_products">Máximo de Productos</Label>
                  <Input
                    id="max_products"
                    type="number"
                    value={limits.max_products || ''}
                    onChange={(e) => setLimits({ 
                      ...limits, 
                      max_products: parseInt(e.target.value) || undefined 
                    })}
                    placeholder="Ej: 1000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_users">Máximo de Usuarios</Label>
                  <Input
                    id="max_users"
                    type="number"
                    value={limits.max_users || ''}
                    onChange={(e) => setLimits({ 
                      ...limits, 
                      max_users: parseInt(e.target.value) || undefined 
                    })}
                    placeholder="Ej: 5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_invoices">Facturas por Mes</Label>
                  <Input
                    id="max_invoices"
                    type="number"
                    value={limits.max_invoices_per_month || ''}
                    onChange={(e) => setLimits({ 
                      ...limits, 
                      max_invoices_per_month: parseInt(e.target.value) || undefined 
                    })}
                    placeholder="Ej: 500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_storage">Almacenamiento (MB)</Label>
                  <Input
                    id="max_storage"
                    type="number"
                    value={limits.max_storage_mb || ''}
                    onChange={(e) => setLimits({ 
                      ...limits, 
                      max_storage_mb: parseInt(e.target.value) || undefined 
                    })}
                    placeholder="Ej: 1024"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_employees">Máximo de Empleados</Label>
                  <Input
                    id="max_employees"
                    type="number"
                    value={limits.max_employees || ''}
                    onChange={(e) => setLimits({ 
                      ...limits, 
                      max_employees: parseInt(e.target.value) || undefined 
                    })}
                    placeholder="Ej: 10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_warehouses">Máximo de Depósitos</Label>
                  <Input
                    id="max_warehouses"
                    type="number"
                    value={limits.max_warehouses || ''}
                    onChange={(e) => setLimits({ 
                      ...limits, 
                      max_warehouses: parseInt(e.target.value) || undefined 
                    })}
                    placeholder="Ej: 3"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Features (separadas por coma)</Label>
                <Textarea
                  id="features"
                  value={limits.features?.join(', ') || ''}
                  onChange={(e) => setLimits({ 
                    ...limits, 
                    features: e.target.value.split(',').map(f => f.trim()).filter(Boolean)
                  })}
                  placeholder="Ej: advanced_reports, api_access, export_excel"
                  rows={3}
                />
              </div>
            </div>

            {/* Dependencies Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Dependencias</h3>
              
              <div className="space-y-2">
                <Label htmlFor="required_modules">Módulos Requeridos (códigos separados por coma)</Label>
                <Textarea
                  id="required_modules"
                  value={dependencies.required_modules.join(', ')}
                  onChange={(e) => setDependencies({ 
                    ...dependencies, 
                    required_modules: e.target.value.split(',').map(m => m.trim()).filter(Boolean)
                  })}
                  placeholder="Ej: employees, products"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Estos módulos deben estar activos para poder activar este módulo
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="incompatible_with">Módulos Incompatibles (códigos separados por coma)</Label>
                <Textarea
                  id="incompatible_with"
                  value={dependencies.incompatible_with.join(', ')}
                  onChange={(e) => setDependencies({ 
                    ...dependencies, 
                    incompatible_with: e.target.value.split(',').map(m => m.trim()).filter(Boolean)
                  })}
                  placeholder="Ej: simple_pos"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Este módulo no puede estar activo si alguno de estos está activo
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSaveModule}
              disabled={updateModuleMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateModuleMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
