import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Permission = "view" | "create" | "edit" | "delete" | "export";
export type Module = 
  | "products" 
  | "sales" 
  | "customers" 
  | "suppliers" 
  | "purchases" 
  | "reports" 
  | "employees" 
  | "settings" 
  | "cash_register" 
  | "technical_services"
  | "quotations"
  | "delivery_notes";

interface RolePermission {
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

export const usePermissions = () => {
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data.map(r => r.role);
    },
    enabled: !!user?.id,
  });

  const { data: permissions } = useQuery({
    queryKey: ["role-permissions", userRoles],
    queryFn: async () => {
      if (!userRoles || userRoles.length === 0) return [];
      
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .in("role", userRoles);
      
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!userRoles && userRoles.length > 0,
  });

  const hasPermission = (module: Module, permission: Permission): boolean => {
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

  return {
    permissions,
    userRoles,
    hasPermission,
    hasRole,
    isAdmin,
    isManager,
    isCashier,
    isAccountant,
    isViewer,
    loading: !permissions,
  };
};
