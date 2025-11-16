import { Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/contexts/CompanyContext";

export function CompanySelector() {
  const { currentCompany, userCompanies, switchCompany, loading } = useCompany();

  if (loading || !currentCompany || userCompanies.length === 0) {
    return null;
  }

  // Don't show selector if user only has one company
  if (userCompanies.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{currentCompany.name}</span>
      </div>
    );
  }

  const getRoleLabel = (role: string) => {
    const map: Record<string, string> = {
      admin: "Administrador",
      manager: "Gerente",
      accountant: "Contador",
      cashier: "Cajero",
      employee: "Empleado",
      viewer: "Visualizador",
      warehouse: "Depósito",
      technician: "Técnico",
      auditor: "Auditor",
    };
    return map[role] || role;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="h-4 w-4" />
          <span className="max-w-[150px] truncate">{currentCompany.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Cambiar empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userCompanies.map((companyUser) => (
          <DropdownMenuItem
            key={companyUser.company_id}
            onClick={() => switchCompany(companyUser.company_id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="font-medium truncate">{companyUser.companies.name}</span>
              <span className="text-xs text-muted-foreground">
                {getRoleLabel(companyUser.role)}
              </span>
            </div>
            {currentCompany.id === companyUser.company_id && (
              <Check className="h-4 w-4 shrink-0 ml-2" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
