import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useActiveModules } from "@/hooks/useActiveModules";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

interface ModuleProtectedRouteProps {
  children: ReactNode;
  moduleCode: string;
  redirectTo?: string;
}

// Módulos base que siempre están disponibles (sincronizado con platform_modules.is_base_module = true)
const BASE_MODULES = ["dashboard", "pos", "products", "sales", "customers", "settings", "reports"];

export function ModuleProtectedRoute({
  children,
  moduleCode,
  redirectTo = "/module-not-available",
}: ModuleProtectedRouteProps) {
  const { data: activeModules = [], isLoading: modulesLoading } = useActiveModules();
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const { isPlatformAdmin, isLoading: adminLoading } = usePlatformAdmin();

  // Mostrar loading mientras se cargan los datos
  if (modulesLoading || permissionsLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Platform admins y admins pueden ver todo
  if (isPlatformAdmin || isAdmin) {
    return <>{children}</>;
  }

  // Módulos base siempre disponibles
  if (BASE_MODULES.includes(moduleCode)) {
    return <>{children}</>;
  }

  // Verificar si el módulo está activo para la empresa
  const hasModule = activeModules.includes(moduleCode);

  if (!hasModule) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
