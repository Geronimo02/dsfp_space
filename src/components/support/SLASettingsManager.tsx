import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { Clock, Save, AlertTriangle, AlertCircle, Info } from "lucide-react";

interface SLASettings {
  id?: string;
  company_id: string;
  default_response_hours: number;
  default_resolution_hours: number;
  high_priority_response_hours: number;
  high_priority_resolution_hours: number;
  medium_priority_response_hours: number;
  medium_priority_resolution_hours: number;
  low_priority_response_hours: number;
  low_priority_resolution_hours: number;
}

export function SLASettingsManager() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<SLASettings>({
    company_id: currentCompany?.id || "",
    default_response_hours: 24,
    default_resolution_hours: 72,
    high_priority_response_hours: 4,
    high_priority_resolution_hours: 24,
    medium_priority_response_hours: 12,
    medium_priority_resolution_hours: 48,
    low_priority_response_hours: 48,
    low_priority_resolution_hours: 120
  });

  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ["sla-settings", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from("customer_support_sla_settings")
        .select("*")
        .eq("company_id", currentCompany.id)
        .maybeSingle();
      if (error) throw error;
      return data as SLASettings | null;
    },
    enabled: !!currentCompany?.id
  });

  useEffect(() => {
    if (existingSettings) {
      setSettings(existingSettings);
    } else if (currentCompany?.id) {
      setSettings(prev => ({ ...prev, company_id: currentCompany.id }));
    }
  }, [existingSettings, currentCompany?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (existingSettings?.id) {
        const { error } = await supabase
          .from("customer_support_sla_settings")
          .update(settings)
          .eq("id", existingSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_support_sla_settings")
          .insert(settings);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuración de SLA guardada");
      queryClient.invalidateQueries({ queryKey: ["sla-settings"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al guardar configuración");
    }
  });

  const handleChange = (field: keyof SLASettings, value: number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const PrioritySection = ({ 
    title, 
    icon: Icon, 
    color, 
    responseField, 
    resolutionField 
  }: { 
    title: string; 
    icon: any; 
    color: string;
    responseField: keyof SLASettings;
    resolutionField: keyof SLASettings;
  }) => (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="font-medium">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 pl-6">
        <div className="space-y-2">
          <Label className="text-sm">Primera Respuesta (horas)</Label>
          <Input
            type="number"
            min="1"
            value={settings[responseField] as number}
            onChange={(e) => handleChange(responseField, parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Resolución (horas)</Label>
          <Input
            type="number"
            min="1"
            value={settings[resolutionField] as number}
            onChange={(e) => handleChange(resolutionField, parseInt(e.target.value) || 0)}
          />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <Card className="animate-pulse h-96" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Configuración de SLA
        </CardTitle>
        <CardDescription>
          Define los tiempos objetivo de respuesta y resolución según la prioridad del ticket
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PrioritySection
          title="Prioridad Urgente"
          icon={AlertTriangle}
          color="text-red-600"
          responseField="high_priority_response_hours"
          resolutionField="high_priority_resolution_hours"
        />

        <PrioritySection
          title="Prioridad Alta"
          icon={AlertCircle}
          color="text-orange-600"
          responseField="high_priority_response_hours"
          resolutionField="high_priority_resolution_hours"
        />

        <PrioritySection
          title="Prioridad Media"
          icon={Clock}
          color="text-blue-600"
          responseField="medium_priority_response_hours"
          resolutionField="medium_priority_resolution_hours"
        />

        <PrioritySection
          title="Prioridad Baja"
          icon={Info}
          color="text-gray-600"
          responseField="low_priority_response_hours"
          resolutionField="low_priority_resolution_hours"
        />

        <div className="border-t pt-4">
          <PrioritySection
            title="Por Defecto"
            icon={Clock}
            color="text-muted-foreground"
            responseField="default_response_hours"
            resolutionField="default_resolution_hours"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => saveMutation.mutate()}>
            <Save className="h-4 w-4 mr-2" />
            Guardar Configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
