import { Button } from "@/components/ui/button";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABLE_MODULES = [
  { id: "inventory", name: "Inventario", description: "Gestión de stock y productos" },
  { id: "reports", name: "Reportes", description: "Informes y análisis avanzados" },
  { id: "pos", name: "Punto de Venta", description: "Sistema de ventas integrado" },
  { id: "accounting", name: "Contabilidad", description: "Gestión contable completa" },
  { id: "crm", name: "CRM", description: "Gestión de clientes" },
  { id: "hr", name: "Recursos Humanos", description: "Gestión de empleados y nómina" },
];

const MODULE_PRICE = 10;

interface Step3ModulesProps {
  formData: SignupFormData;
  updateFormData: (data: Partial<SignupFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export function Step3Modules({ formData, updateFormData, nextStep, prevStep }: Step3ModulesProps) {
  const toggleModule = (moduleId: string) => {
    const modules = formData.modules.includes(moduleId)
      ? formData.modules.filter((m) => m !== moduleId)
      : [...formData.modules, moduleId];
    updateFormData({ modules });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Módulos adicionales</h2>
        <p className="text-muted-foreground">
          Agrega funcionalidades extras • ${MODULE_PRICE} USD por módulo/mes
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AVAILABLE_MODULES.map((module) => {
          const isSelected = formData.modules.includes(module.id);

          return (
            <Card
              key={module.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary shadow-md"
              )}
              onClick={() => toggleModule(module.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{module.name}</CardTitle>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
                <CardDescription className="text-xs">{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="text-xs">
                  +${MODULE_PRICE}/mes
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {formData.modules.length > 0 && (
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm font-medium mb-2">Módulos seleccionados:</p>
          <div className="flex flex-wrap gap-2">
            {formData.modules.map((moduleId) => {
              const module = AVAILABLE_MODULES.find((m) => m.id === moduleId);
              return module ? (
                <Badge key={moduleId} variant="default">
                  {module.name}
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button onClick={prevStep} variant="outline" size="lg">
          Atrás
        </Button>
        <Button onClick={nextStep} size="lg">
          Continuar
        </Button>
      </div>
    </div>
  );
}
