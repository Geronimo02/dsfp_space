import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, Save, User, Settings } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

const MODULES = [
  { code: "pos", name: "Punto de Venta", category: "General" },
  { code: "sales", name: "Ventas", category: "Ventas" },
  { code: "quotations", name: "Presupuestos", category: "Ventas" },
  { code: "delivery_notes", name: "Remitos", category: "Ventas" },
  { code: "returns", name: "Devoluciones", category: "Ventas" },
  { code: "customers", name: "Clientes", category: "Clientes" },
  { code: "products", name: "Productos", category: "Inventario" },
  { code: "purchases", name: "Compras", category: "Compras" },
  { code: "suppliers", name: "Proveedores", category: "Compras" },
  { code: "expenses", name: "Gastos", category: "Finanzas" },
  { code: "cash_register", name: "Caja", category: "Finanzas" },
  { code: "reports", name: "Reportes", category: "Reportes" },
  { code: "employees", name: "Empleados", category: "RRHH" },
  { code: "settings", name: "Configuración", category: "Administración" },
  { code: "technical_services", name: "Servicios Técnicos", category: "Operaciones" },
  { code: "promotions", name: "Promociones", category: "Operaciones" },
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

export function EmployeePermissionsManager() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>("employee");
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current permissions for the selected role
  const { data: rolePermissions, isLoading } = useQuery({
    queryKey: ["role-permissions-config", currentCompany?.id, selectedRole],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("role", selectedRole);
      
      if (error) throw error;
      
      // Convert to record format
      const permsRecord: Record<string, Permission> = {};
      (data || []).forEach((p: RolePermission) => {
        permsRecord[p.module] = {
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
          can_export: p.can_export,
        };
      });
      
      // Initialize missing modules with defaults
      MODULES.forEach(m => {
        if (!permsRecord[m.code]) {
          permsRecord[m.code] = {
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_export: false,
          };
        }
      });
      
      setPermissions(permsRecord);
      setHasChanges(false);
      return data;
    },
    enabled: !!currentCompany?.id,
  });

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

  const updatePermission = (module: string, field: keyof Permission, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
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
    setPermissions(prev => ({
      ...prev,
      [module]: {
        can_view: enabled,
        can_create: enabled,
        can_edit: enabled,
        can_delete: enabled,
        can_export: enabled,
      }
    }));
    setHasChanges(true);
  };

  const groupedModules = MODULES.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<string, typeof MODULES>);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Gestión de Permisos por Rol</CardTitle>
          </div>
          {hasChanges && (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
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
