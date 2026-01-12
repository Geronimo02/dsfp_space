import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DEFAULT_ROLE_PERMISSIONS, Module } from "@/hooks/usePermissions";

import { toast } from "sonner";
import { Shield, Save, Settings, RotateCcw, Info } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AppRole = "admin" | "manager" | "cashier" | "accountant" | "viewer" | "warehouse" | "technician" | "auditor" | "employee";

const AVAILABLE_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: "admin", label: "Administrador", description: "Acceso completo a todos los módulos" },
  { value: "manager", label: "Gerente", description: "Gestión general con algunas restricciones" },
  { value: "cashier", label: "Cajero", description: "Acceso a POS y gestión de caja" },
  { value: "accountant", label: "Contador", description: "Acceso a finanzas y reportes" },
  { value: "warehouse", label: "Depósito", description: "Gestión de inventario y stock" },
  { value: "technician", label: "Técnico", description: "Servicios técnicos" },
  { value: "auditor", label: "Auditor", description: "Solo lectura para auditorías" },
  { value: "viewer", label: "Visualizador", description: "Solo lectura básica" },
  { value: "employee", label: "Empleado", description: "Acceso básico limitado" },
];

interface PermissionModule {
  code: string;
  name: string;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  pos: "General",
  ventas: "Ventas",
  clientes: "Clientes",
  inventario: "Inventario",
  compras: "Compras",
  finanzas: "Finanzas",
  operaciones: "Operaciones",
  rrhh: "RRHH",
  reportes: "Reportes",
  administracion: "AdministraciA3n",
  integraciones: "Integraciones",
  otros: "Otros",
};

const DEFAULT_MODULES: PermissionModule[] = [
  { code: "dashboard", name: "Dashboard", category: "Dashboard" },
  { code: "pos", name: "Punto de Venta", category: "General" },
  { code: "sales", name: "Ventas", category: "Ventas" },
  { code: "quotations", name: "Presupuestos", category: "Ventas" },
  { code: "delivery_notes", name: "Remitos", category: "Ventas" },
  { code: "returns", name: "Devoluciones", category: "Ventas" },
  { code: "reservations", name: "Reservas", category: "Ventas" },
  { code: "customers", name: "Clientes", category: "Clientes" },
  { code: "accounts_receivable", name: "Cuentas Corrientes", category: "Clientes" },
  { code: "customer_support", name: "AtenciA3n al Cliente", category: "Clientes" },
  { code: "products", name: "Productos", category: "Inventario" },
  { code: "inventory_alerts", name: "Alertas de Inventario", category: "Inventario" },
  { code: "warehouses", name: "DepA3sitos", category: "Inventario" },
  { code: "warehouse_stock", name: "Stock por DepA3sito", category: "Inventario" },
  { code: "warehouse_transfers", name: "Transferencias", category: "Inventario" },
  { code: "stock_reservations", name: "Reservas de Stock", category: "Inventario" },
  { code: "purchases", name: "Compras", category: "Compras" },
  { code: "purchase_orders", name: "A\"rdenes de Compra", category: "Compras" },
  { code: "purchase_reception", name: "RecepciA3n de MercaderA-a", category: "Compras" },
  { code: "purchase_returns", name: "Devoluciones a Proveedores", category: "Compras" },
  { code: "suppliers", name: "Proveedores", category: "Compras" },
  { code: "expenses", name: "Gastos", category: "Finanzas" },
  { code: "cash_register", name: "Caja", category: "Finanzas" },
  { code: "bank_accounts", name: "Cuentas Bancarias", category: "Finanzas" },
  { code: "bank_movements", name: "Movimientos Bancarios", category: "Finanzas" },
  { code: "card_movements", name: "Movimientos de Tarjetas", category: "Finanzas" },
  { code: "retentions", name: "Retenciones", category: "Finanzas" },
  { code: "checks", name: "Cheques", category: "Finanzas" },
  { code: "reports", name: "Reportes", category: "Reportes" },
  { code: "accountant_reports", name: "Reportes Contador", category: "Reportes" },
  { code: "employees", name: "Empleados", category: "RRHH" },
  { code: "payroll", name: "Liquidaciones", category: "RRHH" },
  { code: "commissions", name: "Comisiones", category: "RRHH" },
  { code: "audit_logs", name: "AuditorA-a", category: "AdministraciA3n" },
  { code: "access_logs", name: "Logs de Acceso", category: "AdministraciA3n" },
  { code: "monthly_closing", name: "Cierre Mensual", category: "AdministraciA3n" },
  { code: "notifications", name: "Notificaciones", category: "AdministraciA3n" },
  { code: "settings", name: "Configuración", category: "Administración" },
  { code: "technical_services", name: "Servicios Técnicos", category: "Operaciones" },
  { code: "promotions", name: "Promociones", category: "Operaciones" },
  { code: "integrations", name: "Integraciones", category: "Integraciones" },
  { code: "afip", name: "FacturaciA3n AFIP", category: "Integraciones" },
  { code: "pos_afip", name: "Puntos de Venta AFIP", category: "Integraciones" },
  { code: "bulk_operations", name: "Operaciones Masivas", category: "Administración" },
];

interface Permission {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

interface RolePermission extends Permission {
  id?: string;
  role: string;
  module: string;
  company_id: string;
}

export function EmployeePermissionsManager(): JSX.Element {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>("employee");
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isCustomized, setIsCustomized] = useState(false);

  const normalizeCode = (code?: string | null) => (typeof code === "string" ? code.trim() : "");

  const getDefaultPermissions = (role: AppRole, modulesList: PermissionModule[]): Record<string, Permission> => {
    const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role];
    if (!roleDefaults) return {};

    const permsRecord: Record<string, Permission> = {};
    modulesList.forEach((m) => {
      const moduleCode = normalizeCode(m.code);
      if (!moduleCode) return;
      const moduleDefault = roleDefaults[moduleCode as Module];
      permsRecord[moduleCode] = moduleDefault
        ? {
            can_view: moduleDefault.view,
            can_create: moduleDefault.create,
            can_edit: moduleDefault.edit,
            can_delete: moduleDefault.delete,
            can_export: moduleDefault.export,
          }
        : {
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: false,
          };
    });
    return permsRecord;
  };

  const normalizeCategory = (category?: string | null) => {
    if (!category) return CATEGORY_LABELS.otros;
    return CATEGORY_LABELS[category] || category;
  };

  const { data: modules = DEFAULT_MODULES, isLoading: modulesLoading } = useQuery({
    queryKey: ["permission-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_modules")
        .select("code, name, category, is_active, display_order")
        .eq("is_active", true)
        .order("category")
        .order("display_order");

      if (error) throw error;

      const normalizedModules = (data || []).map((module: any) => ({
        code: normalizeCode(module.code),
        name: module.name,
        category: normalizeCategory(module.category),
      }));

      const filteredModules = normalizedModules.filter((module) => module.code.length > 0);
      const uniqueModules = filteredModules.filter(
        (module, index, list) => list.findIndex((item) => item.code === module.code) === index
      );

      if (uniqueModules.length === 0 || uniqueModules.length !== normalizedModules.length) {
        return DEFAULT_MODULES;
      }

      return uniqueModules;
    },
  });

  const normalizedModules = useMemo(() => {
    const modulesList = (modules || []).map((module) => ({
      ...module,
      code: normalizeCode(module.code),
    }));
    const filtered = modulesList.filter((module) => module.code.length > 0);
    const unique = filtered.filter(
      (module, index, list) => list.findIndex((item) => item.code === module.code) === index
    );
    return unique.length > 0 ? unique : DEFAULT_MODULES;
  }, [modules]);

  // Fetch current permissions for the selected role
  const { data: rolePermissions, isLoading: rolePermissionsLoading } = useQuery({
    queryKey: ["role-permissions-config", currentCompany?.id, selectedRole, normalizedModules.map((m) => m.code).join("|")],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("role", selectedRole);
      
      if (error) throw error;

      return data as RolePermission[];
    },
    enabled: !!currentCompany?.id && !modulesLoading,
  });

  useEffect(() => {
    if (!rolePermissions) return;

    if (rolePermissions.length > 0) {
      const permsRecord: Record<string, Permission> = {};
      rolePermissions.forEach((p: RolePermission) => {
        const moduleCode = normalizeCode(p.module);
        if (!moduleCode) return;
        permsRecord[moduleCode] = {
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
          can_export: p.can_export,
        };
      });

      normalizedModules.forEach((m) => {
        const moduleCode = normalizeCode(m.code);
        if (!moduleCode || permsRecord[moduleCode]) return;
        const defaults = DEFAULT_ROLE_PERMISSIONS[selectedRole];
        const moduleDefault = defaults?.[moduleCode as Module];
        permsRecord[moduleCode] = moduleDefault
          ? {
              can_view: moduleDefault.view,
              can_create: moduleDefault.create,
              can_edit: moduleDefault.edit,
              can_delete: moduleDefault.delete,
              can_export: moduleDefault.export,
            }
          : {
              can_view: false,
              can_create: false,
              can_edit: false,
              can_delete: false,
              can_export: false,
            };
      });

      setPermissions(permsRecord);
      setIsCustomized(true);
    } else {
      setPermissions(getDefaultPermissions(selectedRole, normalizedModules));
      setIsCustomized(false);
    }

    setHasChanges(false);
  }, [rolePermissions, selectedRole, normalizedModules]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error("No company selected");
      
      // Delete existing permissions for this role
      await supabase
        .from("role_permissions")
        .delete()
        .eq("company_id", currentCompany.id)
        .eq("role", selectedRole);
      
      // Insert new permissions
      const newPermissions = Object.entries(permissions).map(([module, perms]) => ({
        company_id: currentCompany.id,
        role: selectedRole,
        module,
        ...perms,
      }));
      
      const { error } = await supabase
        .from("role_permissions")
        .insert(newPermissions);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions-config"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      toast.success("Permisos guardados correctamente");
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  const resetToDefaults = () => {
    setPermissions(getDefaultPermissions(selectedRole, normalizedModules));
    setHasChanges(true);
  };

  const updatePermission = (module: string, field: keyof Permission, value: boolean) => {
    const moduleCode = normalizeCode(module);
    if (!moduleCode) return;
    setPermissions(prev => ({
      ...prev,
      [moduleCode]: {
        ...prev[moduleCode],
        [field]: value,
        // Si desactivan view, desactivar todo
        ...(field === "can_view" && !value ? {
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_export: false,
        } : {}),
      }
    }));
    setHasChanges(true);
  };

  const setAllPermissions = (module: string, enabled: boolean) => {
    const moduleCode = normalizeCode(module);
    if (!moduleCode) return;
    setPermissions(prev => ({
      ...prev,
      [moduleCode]: {
        can_view: enabled,
        can_create: enabled,
        can_edit: enabled,
        can_delete: enabled,
        can_export: enabled,
      }
    }));
    setHasChanges(true);
  };

  const groupedModules = normalizedModules.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<string, PermissionModule[]>);

  const isLoading = rolePermissionsLoading || modulesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Gestión de Permisos por Rol</CardTitle>
          </div>
          {hasChanges && (
            <>
              <Button variant="outline" onClick={resetToDefaults}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </>
          )}
        </div>
        <CardDescription>
          Configura los permisos de cada rol para controlar el acceso a los módulos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Seleccionar Rol</Label>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_ROLES.map(role => (
                <SelectItem key={role.value} value={role.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{role.label}</span>
                    <span className="text-xs text-muted-foreground">{role.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isCustomized && selectedRole !== "admin" && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este rol usa los <strong>permisos predeterminados</strong>. Modifica cualquier permiso para personalizar el acceso de este rol.
            </AlertDescription>
          </Alert>
        )}

        {isCustomized && (
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription>
              Este rol tiene <strong>permisos personalizados</strong>. Puedes restaurar los valores predeterminados con el boton "Restaurar".
            </AlertDescription>
          </Alert>
        )}

        {selectedRole === "admin" ? (
          <div className="p-4 bg-muted/50 rounded-lg border">
            <p className="text-sm text-muted-foreground">
              El rol de <strong>Administrador</strong> tiene acceso completo a todos los módulos por defecto.
            </p>
          </div>
        ) : (
          <Accordion type="multiple" className="w-full">
            {Object.entries(groupedModules).map(([category, modules]) => (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>{category}</span>
                    <Badge variant="secondary" className="ml-2">
                      {modules.filter(m => permissions[m.code]?.can_view).length}/{modules.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {modules.map(module => (
                      <div key={module.code} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{module.name}</span>
                            {permissions[module.code]?.can_view && (
                              <Badge variant="outline" className="text-xs">Activo</Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllPermissions(module.code, true)}
                            >
                              Todos
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAllPermissions(module.code, false)}
                            >
                              Ninguno
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={permissions[module.code]?.can_view || false}
                              onCheckedChange={(v) => updatePermission(module.code, "can_view", v)}
                            />
                            <Label className="text-sm">Ver</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={permissions[module.code]?.can_create || false}
                              onCheckedChange={(v) => updatePermission(module.code, "can_create", v)}
                              disabled={!permissions[module.code]?.can_view}
                            />
                            <Label className="text-sm">Crear</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={permissions[module.code]?.can_edit || false}
                              onCheckedChange={(v) => updatePermission(module.code, "can_edit", v)}
                              disabled={!permissions[module.code]?.can_view}
                            />
                            <Label className="text-sm">Editar</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={permissions[module.code]?.can_delete || false}
                              onCheckedChange={(v) => updatePermission(module.code, "can_delete", v)}
                              disabled={!permissions[module.code]?.can_view}
                            />
                            <Label className="text-sm">Eliminar</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={permissions[module.code]?.can_export || false}
                              onCheckedChange={(v) => updatePermission(module.code, "can_export", v)}
                              disabled={!permissions[module.code]?.can_view}
                            />
                            <Label className="text-sm">Exportar</Label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}


