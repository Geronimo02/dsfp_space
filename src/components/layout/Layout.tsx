import { ReactNode, useMemo } from "react";
import { Sidebar } from "./Sidebar";
import { NotificationCenter } from "../NotificationCenter";
import { CompanySelector } from "../CompanySelector";
import { GlobalSearch } from "../GlobalSearch";
import { useCompany } from "@/contexts/CompanyContext";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentCompanyRole } = useCompany();

  const roleInfo = useMemo(() => {
    const map: Record<string, { label: string; color: string }> = {
      admin: { label: "Administrador", color: "bg-red-500" },
      manager: { label: "Gerente", color: "bg-blue-500" },
      cashier: { label: "Cajero", color: "bg-purple-500" },
      accountant: { label: "Contador", color: "bg-yellow-500" },
      warehouse: { label: "Depósito", color: "bg-orange-500" },
      technician: { label: "Técnico", color: "bg-cyan-500" },
      auditor: { label: "Auditor", color: "bg-indigo-500" },
      viewer: { label: "Lectura", color: "bg-gray-500" },
      employee: { label: "Empleado", color: "bg-green-600" },
    };
    if (!currentCompanyRole) return null;
    return map[currentCompanyRole] || { label: currentCompanyRole, color: "bg-muted" };
  }, [currentCompanyRole]);
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-8 py-4 flex justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <CompanySelector />
              {roleInfo && (
                <Badge className={`${roleInfo.color} text-white shadow-sm`}>
                  {roleInfo.label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              <GlobalSearch />
              <NotificationCenter />
            </div>
          </div>
        </div>
        <div className="container mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
