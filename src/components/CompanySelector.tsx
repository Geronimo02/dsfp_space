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
        <Building2 className="h-4 w-4" />
        <span className="font-medium">{currentCompany.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Building2 className="h-4 w-4" />
          <span>{currentCompany.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Cambiar empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userCompanies.map((companyUser) => (
          <DropdownMenuItem
            key={companyUser.company_id}
            onClick={() => switchCompany(companyUser.company_id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col">
              <span>{companyUser.companies.name}</span>
              <span className="text-xs text-muted-foreground capitalize">
                {companyUser.role}
              </span>
            </div>
            {currentCompany.id === companyUser.company_id && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
