import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Plus, Trash, DollarSign, Package, Settings } from "lucide-react";
import {
  usePricingConfig,
  useUpdatePricingConfig,
  usePlatformModules,
  useUpsertModule,
  useDeleteModule,
  InvoiceVolumeTier,
  PlatformModule,
} from "@/hooks/usePricingConfig";
import { formatCurrency } from "@/lib/exportUtils";

export function PricingConfiguration() {
  const { data: config, isLoading: configLoading } = usePricingConfig();
  const { data: modules, isLoading: modulesLoading } = usePlatformModules();
  const updateConfig = useUpdatePricingConfig();
  const upsertModule = useUpsertModule();
  const deleteModule = useDeleteModule();

  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    base_package_price_monthly: 0,
    base_package_price_annual: 0,
    annual_discount_percentage: 0,
  });

  const [volumeTiers, setVolumeTiers] = useState<InvoiceVolumeTier[]>([]);
  const [editingModule, setEditingModule] = useState<Partial<PlatformModule> | null>(null);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);

  // Load config when available
  if (config && !editingConfig && configForm.base_package_price_monthly === 0) {
    setConfigForm({
      base_package_price_monthly: config.base_package_price_monthly,
      base_package_price_annual: config.base_package_price_annual,
      annual_discount_percentage: config.annual_discount_percentage,
    });
    setVolumeTiers(config.invoice_volume_tiers);
  }

  const handleSaveConfig = () => {
    updateConfig.mutate({
      ...configForm,
      invoice_volume_tiers: volumeTiers,
    });
    setEditingConfig(false);
  };

  const handleAddVolumeTier = () => {
    setVolumeTiers([
      ...volumeTiers,
      { min: volumeTiers.length > 0 ? volumeTiers[volumeTiers.length - 1].max! + 1 : 0, max: null, price: 0 },
    ]);
  };

  const handleUpdateVolumeTier = (index: number, field: keyof InvoiceVolumeTier, value: number | null) => {
    const newTiers = [...volumeTiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setVolumeTiers(newTiers);
  };

  const handleRemoveVolumeTier = (index: number) => {
    setVolumeTiers(volumeTiers.filter((_, i) => i !== index));
  };

  const handleEditModule = (module: PlatformModule) => {
    setEditingModule(module);
    setModuleDialogOpen(true);
  };

  const handleCreateModule = () => {
    setEditingModule({
      code: "",
      name: "",
      description: "",
      price_monthly: 0,
      price_annual: 0,
      is_base_module: false,
      is_active: true,
      display_order: modules ? modules.length : 0,
    });
    setModuleDialogOpen(true);
  };

  const handleSaveModule = () => {
    if (editingModule) {
      upsertModule.mutate(editingModule, {
        onSuccess: () => {
          setModuleDialogOpen(false);
          setEditingModule(null);
        },
      });
    }
  };

  const handleDeleteModule = (moduleId: string) => {
    if (confirm("¿Estás seguro de eliminar este módulo?")) {
      deleteModule.mutate(moduleId);
    }
  };

  if (configLoading || modulesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuración de Precios</h2>
          <p className="text-muted-foreground mt-1">
            Gestiona el paquete base, rangos de volumen y módulos del sistema
          </p>
        </div>
      </div>

      <Tabs defaultValue="base" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="base" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Paquete Base</span>
          </TabsTrigger>
          <TabsTrigger value="volume" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Volumen</span>
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Módulos</span>
          </TabsTrigger>
        </TabsList>

        {/* Paquete Base */}
        <TabsContent value="base" className="mt-6">
          <Card className="border-2">
            <CardHeader className="bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Configuración del Paquete Base</CardTitle>
                  <CardDescription className="mt-1.5">
                    Define los precios del paquete base mensual y anual
                  </CardDescription>
                </div>
                <Button
                  onClick={() => (editingConfig ? handleSaveConfig() : setEditingConfig(true))}
                  disabled={updateConfig.isPending}
                  size="lg"
                  className="min-w-[100px]"
                >
                  {editingConfig ? "Guardar" : "Editar"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <div className="space-y-3">
                    <Label htmlFor="monthly-price" className="text-base font-semibold text-blue-900">
                      💰 Precio Mensual
                    </Label>
                    <Input
                      id="monthly-price"
                      type="number"
                      value={configForm.base_package_price_monthly}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          base_package_price_monthly: parseFloat(e.target.value),
                        })
                      }
                      disabled={!editingConfig}
                      className="text-lg font-semibold"
                    />
                    <p className="text-lg font-bold text-blue-700">
                      {formatCurrency(configForm.base_package_price_monthly)}
                    </p>
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <div className="space-y-3">
                    <Label htmlFor="annual-price" className="text-base font-semibold text-green-900">
                      📅 Precio Anual
                    </Label>
                    <Input
                      id="annual-price"
                      type="number"
                      value={configForm.base_package_price_annual}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          base_package_price_annual: parseFloat(e.target.value),
                        })
                      }
                      disabled={!editingConfig}
                      className="text-lg font-semibold"
                    />
                    <p className="text-lg font-bold text-green-700">
                      {formatCurrency(configForm.base_package_price_annual)}
                    </p>
                  </div>
                </Card>
              </div>

              <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="space-y-3">
                  <Label htmlFor="discount" className="text-base font-semibold text-purple-900">
                    🎁 Descuento por Pago Anual (%)
                  </Label>
                  <Input
                    id="discount"
                    type="number"
                    value={configForm.annual_discount_percentage}
                    onChange={(e) =>
                      setConfigForm({
                        ...configForm,
                        annual_discount_percentage: parseFloat(e.target.value),
                      })
                    }
                    disabled={!editingConfig}
                    className="text-lg font-semibold"
                  />
                  <p className="text-sm font-medium text-purple-700">
                    💵 Ahorro de {formatCurrency(
                      (configForm.base_package_price_monthly * 12 * configForm.annual_discount_percentage) / 100
                    )} al año
                  </p>
                </div>
              </Card>

              {editingConfig && (
                <Button variant="outline" onClick={() => setEditingConfig(false)}>
                  Cancelar
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Volumen de Facturas */}
        <TabsContent value="volume" className="mt-6">
          <Card className="border-2">
            <CardHeader className="bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Rangos de Volumen de Facturas</CardTitle>
                  <CardDescription className="mt-1.5">
                    Define los precios adicionales según el volumen mensual de facturas
                  </CardDescription>
                </div>
                <Button onClick={handleAddVolumeTier} disabled={!editingConfig} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Rango
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desde</TableHead>
                    <TableHead>Hasta</TableHead>
                    <TableHead>Precio Adicional</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {volumeTiers.map((tier, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          type="number"
                          value={tier.min}
                          onChange={(e) =>
                            handleUpdateVolumeTier(index, "min", parseInt(e.target.value))
                          }
                          disabled={!editingConfig}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={tier.max ?? ""}
                          onChange={(e) =>
                            handleUpdateVolumeTier(
                              index,
                              "max",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          disabled={!editingConfig}
                          placeholder="Sin límite"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={tier.price}
                          onChange={(e) =>
                            handleUpdateVolumeTier(index, "price", parseFloat(e.target.value))
                          }
                          disabled={!editingConfig}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveVolumeTier(index)}
                          disabled={!editingConfig}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Módulos */}
        <TabsContent value="modules" className="mt-6">
          <Card className="border-2">
            <CardHeader className="bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Gestión de Módulos</CardTitle>
                  <CardDescription className="mt-1.5">
                    Administra los módulos disponibles y sus precios
                  </CardDescription>
                </div>
                <Button onClick={handleCreateModule} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Módulo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Código</TableHead>
                      <TableHead className="font-semibold">Nombre</TableHead>
                      <TableHead className="font-semibold">Precio Mensual</TableHead>
                      <TableHead className="font-semibold">Precio Anual</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="font-semibold">Estado</TableHead>
                      <TableHead className="w-[120px] font-semibold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules?.map((module, index) => (
                      <TableRow key={module.id} className={index % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                        <TableCell>
                          <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                            {module.code}
                          </code>
                        </TableCell>
                        <TableCell className="font-medium">{module.name}</TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          {formatCurrency(module.price_monthly)}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {formatCurrency(module.price_annual)}
                        </TableCell>
                        <TableCell>
                          {module.is_base_module ? (
                            <Badge className="bg-blue-500">Base</Badge>
                          ) : (
                            <Badge variant="secondary">Adicional</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {module.is_active ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              ✓ Activo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                              ✗ Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditModule(module)}
                              className="hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!module.is_base_module && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteModule(module.id)}
                                className="hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar/crear módulo */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingModule?.id ? "Editar Módulo" : "Nuevo Módulo"}
            </DialogTitle>
            <DialogDescription>
              Configura los detalles y precios del módulo
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="module-code">Código</Label>
              <Input
                id="module-code"
                value={editingModule?.code || ""}
                onChange={(e) =>
                  setEditingModule({ ...editingModule, code: e.target.value })
                }
                placeholder="ej: sales, purchases"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module-name">Nombre</Label>
              <Input
                id="module-name"
                value={editingModule?.name || ""}
                onChange={(e) =>
                  setEditingModule({ ...editingModule, name: e.target.value })
                }
                placeholder="ej: Ventas, Compras"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="module-description">Descripción</Label>
              <Input
                id="module-description"
                value={editingModule?.description || ""}
                onChange={(e) =>
                  setEditingModule({ ...editingModule, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module-monthly">Precio Mensual</Label>
              <Input
                id="module-monthly"
                type="number"
                value={editingModule?.price_monthly || 0}
                onChange={(e) =>
                  setEditingModule({
                    ...editingModule,
                    price_monthly: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module-annual">Precio Anual</Label>
              <Input
                id="module-annual"
                type="number"
                value={editingModule?.price_annual || 0}
                onChange={(e) =>
                  setEditingModule({
                    ...editingModule,
                    price_annual: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="module-order">Orden de Visualización</Label>
              <Input
                id="module-order"
                type="number"
                value={editingModule?.display_order || 0}
                onChange={(e) =>
                  setEditingModule({
                    ...editingModule,
                    display_order: parseInt(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center space-x-2 col-span-2">
              <Switch
                id="module-base"
                checked={editingModule?.is_base_module || false}
                onCheckedChange={(checked) =>
                  setEditingModule({ ...editingModule, is_base_module: checked })
                }
              />
              <Label htmlFor="module-base">Módulo Base (incluido en paquete)</Label>
            </div>

            <div className="flex items-center space-x-2 col-span-2">
              <Switch
                id="module-active"
                checked={editingModule?.is_active !== false}
                onCheckedChange={(checked) =>
                  setEditingModule({ ...editingModule, is_active: checked })
                }
              />
              <Label htmlFor="module-active">Módulo Activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveModule} disabled={upsertModule.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
