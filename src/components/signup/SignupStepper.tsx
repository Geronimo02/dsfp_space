import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  description: string;
}

const steps: Step[] = [
  { title: "Datos de cuenta", description: "Información básica" },
  { title: "Elegir plan", description: "Selecciona tu plan" },
  { title: "Método de pago", description: "Añade una tarjeta" },
  { title: "Módulos", description: "Personaliza funciones" },
  { title: "Confirmación", description: "Revisa y finaliza" },
];

interface SignupStepperProps {
  currentStep: number;
}

export function SignupStepper({ currentStep }: SignupStepperProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center flex-1 relative">
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "absolute top-5 left-1/2 h-0.5 w-full -z-10",
                  index < currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            )}
            
            {/* Step circle */}
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all mb-2",
                index < currentStep
                  ? "bg-primary border-primary text-primary-foreground"
                  : index === currentStep
                  ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                  : "bg-background border-muted text-muted-foreground"
              )}
            >
              {index < currentStep ? (
                <Check className="w-5 h-5" />
              ) : (
                <span className="text-sm font-semibold">{index + 1}</span>
              )}
            </div>
            
            {/* Step label */}
            <div className="text-center hidden sm:block">
              <p
                className={cn(
                  "text-sm font-medium",
                  index <= currentStep ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
