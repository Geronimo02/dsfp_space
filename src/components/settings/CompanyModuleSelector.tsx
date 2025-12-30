import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, Package, AlertCircle } from "lucide-react";
import {
  usePlatformModules,
  useCompanyModules,
  useToggleCompanyModule,
  useCalculatePrice,
} from "@/hooks/usePricingConfig";
import { formatCurrency } from "@/lib/exportUtils";

interface CompanyModuleSelectorProps {
  companyId: string;
  onModulesChange?: () => void;
}

export function CompanyModuleSelector({ companyId, onModulesChange }: CompanyModuleSelectorProps) {
  const { data: allModules } = usePlatformModules();
  const { data: companyModules, isLoading, refetch } = useCompanyModules(companyId);
  const toggleModule = useToggleCompanyModule();
  const calculatePrice = useCalculatePrice();

  const [billingCycle] = useState<"monthly" | "annual">("monthly");
  const [calculating, setCalculating] = useState(false);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);

  const handleToggleModule = async (moduleId: string, currentStatus: boolean) => {
    try {
      await toggleModule.mutateAsync({
        companyId,
        moduleId,
        active: !currentStatus,
      });
      // Refetch inmediato para reflejar cambios
      await refetch();
      onModulesChange?.();
      // Recalcular precio
      handleCalculatePrice();
    } catch (error) {
      console.error("Error toggling module:", error);
    }
  };

  const handleCalculatePrice = async () => {
    setCalculating(true);
    try {
      const result = await calculatePrice.mutateAsync({
        companyId,
        billingCycle,
        invoiceVolume: 0, // Esto debería venir de la suscripción
      });
      setPriceBreakdown(result);
    } catch (error) {
      console.error("Error calculating price:", error);
    } finally {
      setCalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Solo incluir módulos activos en activeModuleIds
  const activeModuleIds = companyModules?.filter((cm) => cm.active)?.map((cm) => cm.module_id) || [];
  const baseModules = allModules?.filter((m) => m.is_base_module) || [];
  const additionalModules = allModules?.filter((m) => !m.is_base_module) || [];

  return (
    <div className="space-y-6">
      {/* Módulos Base */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-blue-50/50">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-700" />
            </div>
            <span className="text-blue-900">Módulos Base</span>
          </CardTitle>
          <CardDescription className="mt-1.5">
            ✓ Estos módulos están incluidos automáticamente en el paquete base
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {baseModules.map((module) => (
              <div
                key={module.id}
                className="flex items-center gap-3 p-4 border-2 border-blue-200 rounded-lg bg-blue-50/30 shadow-sm"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
                  <Check className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-blue-900">{module.name}</p>
                  <p className="text-xs text-blue-700 truncate">{module.description}</p>
                </div>
                <Badge className="bg-blue-600">Base</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Módulos Adicionales */}
      <Card className="border-2">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-lg">Módulos Adicionales</CardTitle>
          <CardDescription className="mt-1.5">
            Activa o desactiva módulos adicionales para esta empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {additionalModules.map((module) => {
              const isActive = activeModuleIds.includes(module.id);
              return (
                <div
                  key={module.id}
                  className={`flex items-center gap-4 p-5 border-2 rounded-xl transition-all shadow-sm hover:shadow-md ${
                    isActive 
                      ? "border-green-400 bg-gradient-to-r from-green-50 to-emerald-50" 
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-md ${
                      isActive 
                        ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white" 
                        : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {isActive && <Check className="h-6 w-6" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`font-semibold text-base ${isActive ? "text-green-900" : "text-gray-700"}`}>
                        {module.name}
                      </p>
                      <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                        {module.code}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{module.description}</p>
                  </div>

                  <Switch
                    checked={isActive}
                    onCheckedChange={() => handleToggleModule(module.id, isActive)}
                    disabled={toggleModule.isPending}
                    className="data-[state=checked]:bg-green-600"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
