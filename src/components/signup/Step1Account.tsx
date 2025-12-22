import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SignupFormData } from "@/hooks/useSignupWizard";
import { useState } from "react";
import { z } from "zod";

const accountSchema = z.object({
  email: z.string().email("Email inválido"),
  full_name: z.string().min(1, "Nombre requerido"),
  company_name: z.string().min(1, "Nombre de empresa requerido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

interface Step1AccountProps {
  formData: SignupFormData;
  updateFormData: (data: Partial<SignupFormData>) => void;
  nextStep: () => void;
}

export function Step1Account({ formData, updateFormData, nextStep }: Step1AccountProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNext = () => {
    try {
      accountSchema.parse(formData);
      setErrors({});
      nextStep();
    } catch (e) {
      if (e instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        e.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Crear tu cuenta</h2>
        <p className="text-muted-foreground">Completa tus datos para comenzar</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => updateFormData({ email: e.target.value })}
            placeholder="tu@empresa.com"
          />
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
        </div>

        <div>
          <Label htmlFor="full_name">Nombre completo *</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => updateFormData({ full_name: e.target.value })}
            placeholder="Juan Pérez"
          />
          {errors.full_name && <p className="text-sm text-destructive mt-1">{errors.full_name}</p>}
        </div>

        <div>
          <Label htmlFor="company_name">Nombre de la empresa *</Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => updateFormData({ company_name: e.target.value })}
            placeholder="Mi Empresa SRL"
          />
          {errors.company_name && <p className="text-sm text-destructive mt-1">{errors.company_name}</p>}
        </div>

        <div>
          <Label htmlFor="password">Contraseña *</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => updateFormData({ password: e.target.value })}
            placeholder="Mínimo 8 caracteres"
          />
          {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleNext} size="lg">
          Continuar
        </Button>
      </div>
    </div>
  );
}
