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
        .eq("company_id", currentCompany.id);  // Added company filter
      
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!userRoles && userRoles.length > 0 && !!currentCompany?.id,
  });

  const hasPermission = (module: Module, permission: Permission): boolean => {
    // Admin fallback: if user has admin role, grant all permissions
    if (hasRole("admin")) return true;

    if (!permissions || permissions.length === 0) return false;

    const modulePermissions = permissions.filter(p => p.module === module);
    if (modulePermissions.length === 0) return false;

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
  };

  const hasRole = (role: string): boolean => {
    return userRoles?.some(r => r === role) || false;
  };

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
    loading: userLoading || rolesLoading || permissionsLoading,  // Fixed to use actual loading states
    currentCompany,
    isAdmin,
    isManager,
    isCashier,
    isAccountant,
    isViewer,
    isWarehouse,
    isTechnician,
    isAuditor,
  };
};
