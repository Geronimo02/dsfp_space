import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Pipelines({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [newPipeline, setNewPipeline] = useState({ name: "", stages: "nuevo,en_proceso,ganado,perdido" });

  // Traer pipelines
  const { data: pipelines, isLoading } = useQuery({
    queryKey: ["crm-pipelines", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Crear pipeline
  const mutation = useMutation({
    mutationFn: async (pipeline: any) => {
      const { error } = await supabase.from("crm_pipelines" as any).insert([
        { ...pipeline, company_id: companyId, stages: pipeline.stages.split(",") }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-pipelines", companyId] });
      setNewPipeline({ name: "", stages: "nuevo,en_proceso,ganado,perdido" });
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Pipelines</h2>
      <form
        className="mb-6 flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate(newPipeline);
        }}
      >
        <Input
          placeholder="Nombre del pipeline"
          value={newPipeline.name}
          onChange={e => setNewPipeline(f => ({ ...f, name: e.target.value }))}
          required
        />
        <Input
          placeholder="Etapas (separadas por coma)"
          value={newPipeline.stages}
          onChange={e => setNewPipeline(f => ({ ...f, stages: e.target.value }))}
        />
        <Button type="submit" disabled={mutation.isPending}>
          Crear
        </Button>
      </form>
      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        <ul className="space-y-2">
          {pipelines?.map((p: any) => (
            <li key={p.id} className="border rounded p-3">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">Etapas: {p.stages.join(", ")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
