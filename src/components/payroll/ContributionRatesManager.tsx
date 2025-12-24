import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

interface ContributionRatesManagerProps {
  companyId: string;
}

interface ContributionRates {
  jubilacion_empleado: number;
  obra_social_empleado: number;
  pami_empleado: number;
  sindicato_empleado: number;
  jubilacion_empleador: number;
  obra_social_empleador: number;
  pami_empleador: number;
  art_empleador: number;
  seguro_vida_empleador: number;
}

const defaultRates: ContributionRates = {
  jubilacion_empleado: 11,
  obra_social_empleado: 3,
  pami_empleado: 3,
  sindicato_empleado: 0,
  jubilacion_empleador: 10.17,
  obra_social_empleador: 6,
  pami_empleador: 1.5,
  art_empleador: 2.5,
  seguro_vida_empleador: 0.03,
};

export function ContributionRatesManager({ companyId }: ContributionRatesManagerProps) {
  const queryClient = useQueryClient();
  const [rates, setRates] = useState<ContributionRates>(defaultRates);
  const [isEditing, setIsEditing] = useState(false);

  const { data: savedRates, isLoading } = useQuery({
    queryKey: ["payroll_contribution_rates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_contribution_rates")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;
      // Type assertion since the new columns are not yet in the auto-generated types
      return data as (typeof data & Partial<ContributionRates>) | null;
    },
    enabled: !!companyId,
  });

  // Sync rates when savedRates changes
  useEffect(() => {
    if (savedRates && !isEditing) {
      setRates({
        jubilacion_empleado: savedRates.jubilacion_empleado ?? defaultRates.jubilacion_empleado,
        obra_social_empleado: savedRates.obra_social_empleado ?? defaultRates.obra_social_empleado,
        pami_empleado: savedRates.pami_empleado ?? defaultRates.pami_empleado,
        sindicato_empleado: savedRates.sindicato_empleado ?? defaultRates.sindicato_empleado,
        jubilacion_empleador: savedRates.jubilacion_empleador ?? defaultRates.jubilacion_empleador,
        obra_social_empleador: savedRates.obra_social_empleador ?? defaultRates.obra_social_empleador,
        pami_empleador: savedRates.pami_empleador ?? defaultRates.pami_empleador,
        art_empleador: savedRates.art_empleador ?? defaultRates.art_empleador,
        seguro_vida_empleador: savedRates.seguro_vida_empleador ?? defaultRates.seguro_vida_empleador,
      });
    }
  }, [savedRates, isEditing]);

  const saveMutation = useMutation({
    mutationFn: async (newRates: ContributionRates) => {
      if (savedRates) {
        const { error } = await supabase
          .from("payroll_contribution_rates")
          .update(newRates as any)
          .eq("id", savedRates.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payroll_contribution_rates")
          .insert({
            company_id: companyId,
            code: "default",
            name: "Tasas por Defecto",
            ...newRates,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll_contribution_rates"] });
      toast.success("Tasas de contribución actualizadas");
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate(rates);
  };

  const handleChange = (key: keyof ContributionRates, value: string) => {
    setRates((prev) => ({
      ...prev,
      [key]: parseFloat(value) || 0,
    }));
  };

  const totalEmpleado = rates.jubilacion_empleado + rates.obra_social_empleado + rates.pami_empleado + rates.sindicato_empleado;
  const totalEmpleador = rates.jubilacion_empleador + rates.obra_social_empleador + rates.pami_empleador + rates.art_empleador + rates.seguro_vida_empleador;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Tasas de Contribución
            </CardTitle>
            <CardDescription>
              Configurá los porcentajes de aportes y contribuciones patronales
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Aportes del Empleado */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Aportes del Empleado
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">Jubilación</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.jubilacion_empleado}
                      onChange={(e) => handleChange("jubilacion_empleado", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.jubilacion_empleado}%</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">Obra Social</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.obra_social_empleado}
                      onChange={(e) => handleChange("obra_social_empleado", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.obra_social_empleado}%</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">PAMI (Ley 19032)</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.pami_empleado}
                      onChange={(e) => handleChange("pami_empleado", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.pami_empleado}%</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">Sindicato</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.sindicato_empleado}
                      onChange={(e) => handleChange("sindicato_empleado", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.sindicato_empleado}%</span>
                )}
              </div>
              <div className="border-t pt-2 flex items-center justify-between font-semibold">
                <span>Total Aportes</span>
                <span className="font-mono text-destructive">{totalEmpleado.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Contribuciones del Empleador */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Contribuciones Patronales
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">Jubilación</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.jubilacion_empleador}
                      onChange={(e) => handleChange("jubilacion_empleador", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.jubilacion_empleador}%</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">Obra Social</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.obra_social_empleador}
                      onChange={(e) => handleChange("obra_social_empleador", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.obra_social_empleador}%</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">PAMI (Ley 19032)</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.pami_empleador}
                      onChange={(e) => handleChange("pami_empleador", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.pami_empleador}%</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">ART</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.art_empleador}
                      onChange={(e) => handleChange("art_empleador", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.art_empleador}%</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label className="flex-1">Seguro de Vida</Label>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={rates.seguro_vida_empleador}
                      onChange={(e) => handleChange("seguro_vida_empleador", e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                ) : (
                  <span className="font-mono">{rates.seguro_vida_empleador}%</span>
                )}
              </div>
              <div className="border-t pt-2 flex items-center justify-between font-semibold">
                <span>Total Contribuciones</span>
                <span className="font-mono text-amber-600">{totalEmpleador.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
