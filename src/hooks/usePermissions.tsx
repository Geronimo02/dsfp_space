import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export type Permission = "view" | "create" | "edit" | "delete" | "export";
export type Module = 
  | "dashboard"
  | "pos"
  | "products" 
  | "sales" 
  | "customers" 
  | "suppliers" 
  | "purchases" 
  | "reports" 
  | "employees"
  | "time_tracking"
  | "settings" 
  | "cash_register" 
  | "technical_services"
  | "quotations"
  | "delivery_notes"
  | "promotions"
  | "returns"
  | "credit_notes"
  | "expenses"
  | "bulk_operations"
  | "pos_afip";

interface RolePermission {
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

// Permisos por defecto para cada rol cuando no hay permisos personalizados
const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<Module, { view: boolean; create: boolean; edit: boolean; delete: boolean; export: boolean }>> = {
  admin: {
    dashboard: { view: true, create: true, edit: true, delete: true, export: true },
    pos: { view: true, create: true, edit: true, delete: true, export: true },
    products: { view: true, create: true, edit: true, delete: true, export: true },
    sales: { view: true, create: true, edit: true, delete: true, export: true },
    customers: { view: true, create: true, edit: true, delete: true, export: true },
    suppliers: { view: true, create: true, edit: true, delete: true, export: true },
    purchases: { view: true, create: true, edit: true, delete: true, export: true },
    reports: { view: true, create: true, edit: true, delete: true, export: true },
    employees: { view: true, create: true, edit: true, delete: true, export: true },
    time_tracking: { view: true, create: true, edit: true, delete: true, export: true },
    settings: { view: true, create: true, edit: true, delete: true, export: true },
    cash_register: { view: true, create: true, edit: true, delete: true, export: true },
    technical_services: { view: true, create: true, edit: true, delete: true, export: true },
    quotations: { view: true, create: true, edit: true, delete: true, export: true },
    delivery_notes: { view: true, create: true, edit: true, delete: true, export: true },
    promotions: { view: true, create: true, edit: true, delete: true, export: true },
    returns: { view: true, create: true, edit: true, delete: true, export: true },
    credit_notes: { view: true, create: true, edit: true, delete: true, export: true },
    expenses: { view: true, create: true, edit: true, delete: true, export: true },
    bulk_operations: { view: true, create: true, edit: true, delete: true, export: true },
    pos_afip: { view: true, create: true, edit: true, delete: true, export: true },
  },
  manager: {
    dashboard: { view: true, create: true, edit: true, delete: false, export: true },
    pos: { view: true, create: true, edit: true, delete: false, export: true },
    products: { view: true, create: true, edit: true, delete: false, export: true },
    sales: { view: true, create: true, edit: true, delete: false, export: true },
    customers: { view: true, create: true, edit: true, delete: false, export: true },
    suppliers: { view: true, create: true, edit: true, delete: false, export: true },
    purchases: { view: true, create: true, edit: true, delete: false, export: true },
    reports: { view: true, create: true, edit: true, delete: false, export: true },
    employees: { view: true, create: true, edit: true, delete: false, export: true },
    time_tracking: { view: true, create: true, edit: true, delete: false, export: true },
    settings: { view: true, create: false, edit: false, delete: false, export: false },
    cash_register: { view: true, create: true, edit: true, delete: false, export: true },
    technical_services: { view: true, create: true, edit: true, delete: false, export: true },
    quotations: { view: true, create: true, edit: true, delete: false, export: true },
    delivery_notes: { view: true, create: true, edit: true, delete: false, export: true },
    promotions: { view: true, create: true, edit: true, delete: false, export: true },
    returns: { view: true, create: true, edit: true, delete: false, export: true },
    credit_notes: { view: true, create: true, edit: true, delete: false, export: true },
    expenses: { view: true, create: true, edit: true, delete: false, export: true },
    bulk_operations: { view: true, create: true, edit: true, delete: false, export: true },
    pos_afip: { view: true, create: true, edit: true, delete: false, export: true },
  },
  cashier: {
    dashboard: { view: true, create: false, edit: false, delete: false, export: false },
    pos: { view: true, create: true, edit: true, delete: false, export: false },
    products: { view: true, create: false, edit: false, delete: false, export: false },
    sales: { view: true, create: true, edit: false, delete: false, export: false },
    customers: { view: true, create: true, edit: false, delete: false, export: false },
    suppliers: { view: false, create: false, edit: false, delete: false, export: false },
    purchases: { view: false, create: false, edit: false, delete: false, export: false },
    reports: { view: false, create: false, edit: false, delete: false, export: false },
    employees: { view: false, create: false, edit: false, delete: false, export: false },
    time_tracking: { view: true, create: true, edit: false, delete: false, export: false },
    settings: { view: false, create: false, edit: false, delete: false, export: false },
    cash_register: { view: true, create: true, edit: true, delete: false, export: false },
    technical_services: { view: false, create: false, edit: false, delete: false, export: false },
    quotations: { view: true, create: true, edit: false, delete: false, export: false },
    delivery_notes: { view: true, create: true, edit: false, delete: false, export: false },
    promotions: { view: true, create: false, edit: false, delete: false, export: false },
    returns: { view: true, create: true, edit: false, delete: false, export: false },
    credit_notes: { view: true, create: false, edit: false, delete: false, export: false },
    expenses: { view: false, create: false, edit: false, delete: false, export: false },
    bulk_operations: { view: false, create: false, edit: false, delete: false, export: false },
    pos_afip: { view: true, create: true, edit: false, delete: false, export: false },
  },
  warehouse: {
    dashboard: { view: true, create: false, edit: false, delete: false, export: false },
    pos: { view: false, create: false, edit: false, delete: false, export: false },
    products: { view: true, create: true, edit: true, delete: false, export: true },
    sales: { view: true, create: false, edit: false, delete: false, export: false },
    customers: { view: false, create: false, edit: false, delete: false, export: false },
    suppliers: { view: true, create: true, edit: true, delete: false, export: true },
    purchases: { view: true, create: true, edit: true, delete: false, export: true },
    reports: { view: true, create: false, edit: false, delete: false, export: true },
    employees: { view: false, create: false, edit: false, delete: false, export: false },
    time_tracking: { view: true, create: true, edit: false, delete: false, export: false },
    settings: { view: false, create: false, edit: false, delete: false, export: false },
    cash_register: { view: false, create: false, edit: false, delete: false, export: false },
    technical_services: { view: false, create: false, edit: false, delete: false, export: false },
    quotations: { view: true, create: false, edit: false, delete: false, export: false },
    delivery_notes: { view: true, create: true, edit: true, delete: false, export: true },
    promotions: { view: false, create: false, edit: false, delete: false, export: false },
    returns: { view: true, create: true, edit: false, delete: false, export: false },
    credit_notes: { view: false, create: false, edit: false, delete: false, export: false },
    expenses: { view: false, create: false, edit: false, delete: false, export: false },
    bulk_operations: { view: true, create: true, edit: false, delete: false, export: false },
    pos_afip: { view: false, create: false, edit: false, delete: false, export: false },
  },
  technician: {
    dashboard: { view: true, create: false, edit: false, delete: false, export: false },
    pos: { view: false, create: false, edit: false, delete: false, export: false },
    products: { view: true, create: false, edit: false, delete: false, export: false },
    sales: { view: false, create: false, edit: false, delete: false, export: false },
    customers: { view: true, create: false, edit: false, delete: false, export: false },
    suppliers: { view: false, create: false, edit: false, delete: false, export: false },
    purchases: { view: false, create: false, edit: false, delete: false, export: false },
    reports: { view: false, create: false, edit: false, delete: false, export: false },
    employees: { view: false, create: false, edit: false, delete: false, export: false },
    time_tracking: { view: true, create: true, edit: false, delete: false, export: false },
    settings: { view: false, create: false, edit: false, delete: false, export: false },
    cash_register: { view: false, create: false, edit: false, delete: false, export: false },
    technical_services: { view: true, create: true, edit: true, delete: false, export: true },
    quotations: { view: true, create: true, edit: true, delete: false, export: true },
    delivery_notes: { view: true, create: true, edit: false, delete: false, export: false },
    promotions: { view: false, create: false, edit: false, delete: false, export: false },
    returns: { view: false, create: false, edit: false, delete: false, export: false },
    credit_notes: { view: false, create: false, edit: false, delete: false, export: false },
    expenses: { view: false, create: false, edit: false, delete: false, export: false },
    bulk_operations: { view: false, create: false, edit: false, delete: false, export: false },
    pos_afip: { view: false, create: false, edit: false, delete: false, export: false },
  },
  accountant: {
    dashboard: { view: true, create: false, edit: false, delete: false, export: true },
    pos: { view: false, create: false, edit: false, delete: false, export: false },
    products: { view: true, create: false, edit: false, delete: false, export: true },
    sales: { view: true, create: false, edit: false, delete: false, export: true },
    customers: { view: true, create: false, edit: false, delete: false, export: true },
    suppliers: { view: true, create: false, edit: false, delete: false, export: true },
    purchases: { view: true, create: false, edit: false, delete: false, export: true },
    reports: { view: true, create: false, edit: false, delete: false, export: true },
    employees: { view: true, create: false, edit: false, delete: false, export: true },
    time_tracking: { view: true, create: false, edit: false, delete: false, export: true },
    settings: { view: false, create: false, edit: false, delete: false, export: false },
    cash_register: { view: true, create: false, edit: false, delete: false, export: true },
    technical_services: { view: true, create: false, edit: false, delete: false, export: true },
    quotations: { view: true, create: false, edit: false, delete: false, export: true },
    delivery_notes: { view: true, create: false, edit: false, delete: false, export: true },
    promotions: { view: true, create: false, edit: false, delete: false, export: true },
    returns: { view: true, create: false, edit: false, delete: false, export: true },
    credit_notes: { view: true, create: false, edit: false, delete: false, export: true },
    expenses: { view: true, create: false, edit: false, delete: false, export: true },
    bulk_operations: { view: true, create: false, edit: false, delete: false, export: true },
    pos_afip: { view: true, create: false, edit: false, delete: false, export: true },
  },
  auditor: {
    dashboard: { view: true, create: false, edit: false, delete: false, export: true },
    pos: { view: true, create: false, edit: false, delete: false, export: true },
    products: { view: true, create: false, edit: false, delete: false, export: true },
    sales: { view: true, create: false, edit: false, delete: false, export: true },
    customers: { view: true, create: false, edit: false, delete: false, export: true },
    suppliers: { view: true, create: false, edit: false, delete: false, export: true },
    purchases: { view: true, create: false, edit: false, delete: false, export: true },
    reports: { view: true, create: false, edit: false, delete: false, export: true },
    employees: { view: true, create: false, edit: false, delete: false, export: true },
    time_tracking: { view: true, create: false, edit: false, delete: false, export: true },
    settings: { view: true, create: false, edit: false, delete: false, export: true },
    cash_register: { view: true, create: false, edit: false, delete: false, export: true },
    technical_services: { view: true, create: false, edit: false, delete: false, export: true },
    quotations: { view: true, create: false, edit: false, delete: false, export: true },
    delivery_notes: { view: true, create: false, edit: false, delete: false, export: true },
    promotions: { view: true, create: false, edit: false, delete: false, export: true },
    returns: { view: true, create: false, edit: false, delete: false, export: true },
    credit_notes: { view: true, create: false, edit: false, delete: false, export: true },
    expenses: { view: true, create: false, edit: false, delete: false, export: true },
    bulk_operations: { view: true, create: false, edit: false, delete: false, export: true },
    pos_afip: { view: true, create: false, edit: false, delete: false, export: true },
  },
  viewer: {
    dashboard: { view: true, create: false, edit: false, delete: false, export: false },
    pos: { view: true, create: false, edit: false, delete: false, export: false },
    products: { view: true, create: false, edit: false, delete: false, export: false },
    sales: { view: true, create: false, edit: false, delete: false, export: false },
    customers: { view: true, create: false, edit: false, delete: false, export: false },
    suppliers: { view: true, create: false, edit: false, delete: false, export: false },
    purchases: { view: true, create: false, edit: false, delete: false, export: false },
    reports: { view: true, create: false, edit: false, delete: false, export: false },
    employees: { view: false, create: false, edit: false, delete: false, export: false },
    time_tracking: { view: true, create: true, edit: false, delete: false, export: false },
    settings: { view: false, create: false, edit: false, delete: false, export: false },
    cash_register: { view: true, create: false, edit: false, delete: false, export: false },
    technical_services: { view: true, create: false, edit: false, delete: false, export: false },
    quotations: { view: true, create: false, edit: false, delete: false, export: false },
    delivery_notes: { view: true, create: false, edit: false, delete: false, export: false },
    promotions: { view: true, create: false, edit: false, delete: false, export: false },
    returns: { view: true, create: false, edit: false, delete: false, export: false },
    credit_notes: { view: true, create: false, edit: false, delete: false, export: false },
    expenses: { view: true, create: false, edit: false, delete: false, export: false },
    bulk_operations: { view: false, create: false, edit: false, delete: false, export: false },
    pos_afip: { view: true, create: false, edit: false, delete: false, export: false },
  },
  employee: {
    dashboard: { view: true, create: false, edit: false, delete: false, export: false },
    pos: { view: false, create: false, edit: false, delete: false, export: false },
    products: { view: false, create: false, edit: false, delete: false, export: false },
    sales: { view: false, create: false, edit: false, delete: false, export: false },
    customers: { view: false, create: false, edit: false, delete: false, export: false },
    suppliers: { view: false, create: false, edit: false, delete: false, export: false },
    purchases: { view: false, create: false, edit: false, delete: false, export: false },
    reports: { view: false, create: false, edit: false, delete: false, export: false },
    employees: { view: false, create: false, edit: false, delete: false, export: false },
    time_tracking: { view: true, create: true, edit: false, delete: false, export: false },
    settings: { view: false, create: false, edit: false, delete: false, export: false },
    cash_register: { view: false, create: false, edit: false, delete: false, export: false },
    technical_services: { view: false, create: false, edit: false, delete: false, export: false },
    quotations: { view: false, create: false, edit: false, delete: false, export: false },
    delivery_notes: { view: false, create: false, edit: false, delete: false, export: false },
    promotions: { view: false, create: false, edit: false, delete: false, export: false },
    returns: { view: false, create: false, edit: false, delete: false, export: false },
    credit_notes: { view: false, create: false, edit: false, delete: false, export: false },
    expenses: { view: false, create: false, edit: false, delete: false, export: false },
    bulk_operations: { view: false, create: false, edit: false, delete: false, export: false },
    pos_afip: { view: false, create: false, edit: false, delete: false, export: false },
  },
};

export function usePermissions() {
  const { currentCompany } = useCompany();
  
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", user?.id, currentCompany?.id],
    queryFn: async () => {
      if (!user?.id || !currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("company_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      
      if (error) throw error;
      return data.map(r => r.role);
    },
    enabled: !!user?.id && !!currentCompany?.id,
  });

  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["role-permissions", userRoles, currentCompany?.id],
    queryFn: async () => {
      if (!userRoles || userRoles.length === 0 || !currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .in("role", userRoles)
        .eq("company_id", currentCompany.id);
      
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!userRoles && userRoles.length > 0 && !!currentCompany?.id,
  });

  const hasPermission = (module: Module, permission: Permission): boolean => {
    // Si no hay roles cargados, no tiene permisos
    if (!userRoles || userRoles.length === 0) return false;

    // Admin siempre tiene todos los permisos
    if (userRoles.includes("admin")) return true;
    
    // Primero verificar permisos personalizados de la empresa
    if (permissions && permissions.length > 0) {
      const modulePermissions = permissions.filter(p => p.module === module);
      if (modulePermissions.length > 0) {
        return modulePermissions.some(p => {
          switch (permission) {
            case "view": return p.can_view;
            case "create": return p.can_create;
            case "edit": return p.can_edit;
            case "delete": return p.can_delete;
            case "export": return p.can_export;
            default: return false;
          }
        });
      }
    }

    // Si no hay permisos personalizados, usar los permisos por defecto del rol
    for (const role of userRoles) {
      const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role];
      if (roleDefaults && roleDefaults[module]) {
        const moduleDefault = roleDefaults[module];
        switch (permission) {
          case "view": if (moduleDefault.view) return true; break;
          case "create": if (moduleDefault.create) return true; break;
          case "edit": if (moduleDefault.edit) return true; break;
          case "delete": if (moduleDefault.delete) return true; break;
          case "export": if (moduleDefault.export) return true; break;
        }
      }
    }

    return false;
  };

  const hasRole = (role: string): boolean => {
    return userRoles?.some(r => r === role) || false;
  };

  // Helper para verificar si puede gestionar empleados/horarios
  const canManageEmployees = userRoles?.some(r => ["admin", "manager"].includes(r)) || false;
  const canManageTimeTracking = userRoles?.some(r => ["admin", "manager"].includes(r)) || false;

  const isAdmin = hasRole("admin");
  const isManager = hasRole("manager");
  const isCashier = hasRole("cashier");
  const isAccountant = hasRole("accountant");
  const isViewer = hasRole("viewer");
  const isWarehouse = hasRole("warehouse");
  const isTechnician = hasRole("technician");
  const isAuditor = hasRole("auditor");

  return {
    permissions,
    userRoles,
    hasPermission,
    loading: userLoading || rolesLoading || permissionsLoading,
    currentCompany,
    isAdmin,
    isManager,
    isCashier,
    isAccountant,
    isViewer,
    isWarehouse,
    isTechnician,
    isAuditor,
    canManageEmployees,
    canManageTimeTracking,
  };
}

// Exportar los permisos por defecto para uso en otros componentes
export { DEFAULT_ROLE_PERMISSIONS };
