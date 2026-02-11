import { ReactNode, useMemo, memo } from "react";
import { Navigate } from "react-router-dom";
import { useActiveModules } from "@/hooks/useActiveModules";
import { Permission, Module, usePermissions } from "@/hooks/usePermissions";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useAuth } from "@/hooks/useAuth";
import { LoadingState } from "./LoadingState";

interface ModuleProtectedRouteProps {
  children: ReactNode;
  moduleCode: string;
  redirectTo?: string;
  permission?: Permission;
}

// Módulos base que siempre están disponibles (sincronizado con platform_modules.is_base_module = true)
const BASE_MODULES = ["dashboard", "pos", "products", "sales", "customers", "settings", "reports"];

function ModuleProtectedRouteComponent({
  children,
  moduleCode,
  redirectTo = "/module-not-available",
  permission = "view",
}: ModuleProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { data: activeModules = [], isLoading: modulesLoading } = useActiveModules();
  const { isAdmin, hasPermission, loading: permissionsLoading } = usePermissions();
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();

  // Memoize loading state
  const isLoading = useMemo(
    () => authLoading || modulesLoading || permissionsLoading || adminLoading,
    [authLoading, modulesLoading, permissionsLoading, adminLoading]
  );

  // Memoize permission check
  const hasRolePermission = useMemo(
    () => hasPermission(moduleCode as Module, permission),
    [hasPermission, moduleCode, permission]
  );

  // Memoize module access check
  const hasModule = useMemo(
    () => activeModules.includes(moduleCode),
    [activeModules, moduleCode]
  );

  // Mostrar loading mientras se cargan los datos
  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  // Verificar autenticación
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Verificar permiso de rol para el módulo
  if (!hasRolePermission) {
    return <Navigate to={redirectTo} replace />;
  }

  // Módulos base siempre disponibles si el rol tiene permiso
  if (BASE_MODULES.includes(moduleCode)) {
    return <>{children}</>;
  }

  // Verificar si el módulo está activo para la empresa
  if (!hasModule) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

// Export memoized component
export const ModuleProtectedRoute = memo(ModuleProtectedRouteComponent);
