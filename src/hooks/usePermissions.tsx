import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export type Permission = "view" | "create" | "edit" | "delete" | "export";
export type Module =
  | "dashboard"
  | "pos"
  | "sales"
  | "quotations"
  | "delivery_notes"
  | "returns"
  | "reservations"
  | "customers"
  | "accounts_receivable"
  | "customer_support"
  | "products"
  | "inventory_alerts"
  | "warehouses"
  | "warehouse_stock"
  | "warehouse_transfers"
  | "stock_reservations"
  | "purchases"
  | "purchase_orders"
  | "purchase_reception"
  | "purchase_returns"
  | "suppliers"
  | "expenses"
  | "cash_register"
  | "bank_accounts"
  | "bank_movements"
  | "card_movements"
  | "retentions"
  | "checks"
  | "reports"
  | "accountant_reports"
  | "employees"
  | "payroll"
  | "commissions"
  | "audit_logs"
  | "access_logs"
  | "monthly_closing"
  | "notifications"
  | "settings"
  | "technical_services"
  | "promotions"
  | "integrations"
  | "afip"
  | "pos_afip"
  | "bulk_operations";

export type AppRole =
  | "admin"
  | "manager"
  | "cashier"
  | "accountant"
  | "viewer"
  | "warehouse"
  | "technician"
  | "auditor"
  | "employee";

type RolePermissionDefaults = Record<Module, Record<Permission, boolean>>;

interface RolePermission {
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
}

const ALL_MODULES: Module[] = [
  "dashboard",
  "pos",
  "sales",
  "quotations",
  "delivery_notes",
  "returns",
  "reservations",
  "customers",
  "accounts_receivable",
  "customer_support",
  "products",
  "inventory_alerts",
  "warehouses",
  "warehouse_stock",
  "warehouse_transfers",
  "stock_reservations",
  "purchases",
  "purchase_orders",
  "purchase_reception",
  "purchase_returns",
  "suppliers",
  "expenses",
  "cash_register",
  "bank_accounts",
  "bank_movements",
  "card_movements",
  "retentions",
  "checks",
  "reports",
  "accountant_reports",
  "employees",
  "payroll",
  "commissions",
  "audit_logs",
  "access_logs",
  "monthly_closing",
  "notifications",
  "settings",
  "technical_services",
  "promotions",
  "integrations",
  "afip",
  "pos_afip",
  "bulk_operations",
];

const allowAll = (modules: Module[], perms: Record<Permission, boolean>) =>
  modules.reduce((acc, module) => {
    acc[module] = perms;
    return acc;
  }, {} as RolePermissionDefaults);

const DEFAULT_VIEW_ONLY = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  export: false,
};

const DEFAULT_VIEW_EXPORT = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  export: true,
};

const DEFAULT_NO_DELETE = {
  view: true,
  create: true,
  edit: true,
  delete: false,
  export: true,
};

const DEFAULT_FULL = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  export: true,
};

export const DEFAULT_ROLE_PERMISSIONS: Record<AppRole, Partial<RolePermissionDefaults>> = {
  admin: allowAll(ALL_MODULES, DEFAULT_FULL),
  manager: {
    ...allowAll(
      [
        "dashboard",
        "sales",
        "quotations",
        "delivery_notes",
        "returns",
        "reservations",
        "customers",
        "accounts_receivable",
        "products",
        "inventory_alerts",
        "warehouses",
        "warehouse_stock",
        "warehouse_transfers",
        "stock_reservations",
        "employees",
        "reports",
        "accountant_reports",
        "expenses",
      ],
      DEFAULT_NO_DELETE
    ),
  },
  cashier: {
    ...allowAll(
      ["pos", "sales", "returns", "cash_register", "customers"],
      {
        view: true,
        create: true,
        edit: true,
        delete: false,
        export: false,
      }
    ),
    products: DEFAULT_VIEW_ONLY,
    inventory_alerts: DEFAULT_VIEW_ONLY,
  },
  warehouse: {
    ...allowAll(
      [
        "products",
        "inventory_alerts",
        "warehouses",
        "warehouse_stock",
        "warehouse_transfers",
        "stock_reservations",
        "purchases",
        "purchase_orders",
        "purchase_reception",
        "purchase_returns",
        "suppliers",
        "reports",
      ],
      {
        view: true,
        create: true,
        edit: true,
        delete: false,
        export: false,
      }
    ),
  },
  technician: {
    ...allowAll(["technical_services", "quotations", "customers"], {
      view: true,
      create: true,
      edit: true,
      delete: false,
      export: false,
    }),
    products: DEFAULT_VIEW_ONLY,
  },
  accountant: {
    ...allowAll(
      [
        "reports",
        "accountant_reports",
        "expenses",
        "cash_register",
        "bank_accounts",
        "bank_movements",
        "card_movements",
        "retentions",
        "checks",
        "accounts_receivable",
        "customers",
        "sales",
        "purchases",
        "purchase_orders",
        "suppliers",
      ],
      DEFAULT_VIEW_EXPORT
    ),
  },
  auditor: {
    ...allowAll(
      [
        "audit_logs",
        "access_logs",
        "reports",
        "accountant_reports",
        "sales",
        "cash_register",
        "bank_accounts",
        "bank_movements",
        "card_movements",
        "retentions",
        "checks",
        "inventory_alerts",
        "warehouse_stock",
        "warehouse_transfers",
        "products",
        "employees",
      ],
      DEFAULT_VIEW_EXPORT
    ),
  },
  viewer: {
    ...allowAll(["dashboard", "reports", "sales", "products", "customers"], DEFAULT_VIEW_ONLY),
  },
  employee: {
    // Agregar dashboard para evitar redirect loop al iniciar sesión
    ...allowAll(["dashboard", "employees"], DEFAULT_VIEW_ONLY),
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
        .select("role, platform_admin")
        .eq("user_id", user.id)
        .eq("company_id", currentCompany.id)
        .or("active.eq.true,active.is.null");
      
      if (error) throw error;
      return data.map(r => ({
        role: r.role,
        platform_admin: r.platform_admin || false,
      }));
    },
    enabled: !!user?.id && !!currentCompany?.id,
  });

  const roleNames = userRoles?.map(r => r.role) || [];

  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ["role-permissions", roleNames, currentCompany?.id],
    queryFn: async () => {
      if (roleNames.length === 0 || !currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .in("role", roleNames)
        .eq("company_id", currentCompany.id);  // Added company filter
      
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: roleNames.length > 0 && !!currentCompany?.id,
  });

  const hasPermission = (module: Module, permission: Permission): boolean => {
    if (hasRole("admin")) return true;

    const roles = roleNames;
    if (roles.length === 0) return false;

    const modulePermissions = (permissions || []).filter((p) => p.module === module);


    const hasCustomPermission = (role: string) =>
      modulePermissions.some((p) => {
        if (p.role !== role) return false;
        switch (permission) {
          case "view":
            return p.can_view;
          case "create":
            return p.can_create;
          case "edit":
            return p.can_edit;
          case "delete":
            return p.can_delete;
          case "export":
            return p.can_export;
          default:
            return false;
        }
      });

    const hasDefaultPermission = (role: string) => {
      const defaults = DEFAULT_ROLE_PERMISSIONS[role as AppRole];
      const moduleDefaults = defaults?.[module];
      if (!moduleDefaults) return false;
      return moduleDefaults[permission] || false;
    };

    return roles.some((role) => {
      const hasCustomForRole = modulePermissions.some((p) => p.role === role);
      if (hasCustomForRole) {
        return hasCustomPermission(role);
      }
      return hasDefaultPermission(role);
    });
  };

  const hasRole = (role: string): boolean => {
    return userRoles?.some(r => r.role === role) || false;
  };

  const isPlatformAdmin = userRoles?.some(r => r.platform_admin) || false;
  const isAdmin = hasRole("admin") || isPlatformAdmin;

  const isManager = hasRole("manager");
  const isCashier = hasRole("cashier");
  const isAccountant = hasRole("accountant");
  const isViewer = hasRole("viewer");
  const isWarehouse = hasRole("warehouse");
  const isTechnician = hasRole("technician");
  const isAuditor = hasRole("auditor");
  const isEmployee = hasRole("employee");
  const canManageEmployees = isAdmin || isManager;
  const canManageTimeTracking = isAdmin || isManager;

  return {
    permissions,
    userRoles: userRoles?.map(r => r.role) || [],
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
    isEmployee,
    canManageEmployees,
    canManageTimeTracking,
  };
};
