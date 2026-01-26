
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function OpportunitiesList({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    value: "",
    probability: 0,
    estimated_close_date: "",
    customer_id: "",
    owner_id: "",
  });

  // Traer oportunidades con join a clientes
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ["crm-opportunities", companyId],
    queryFn: async () => {
     
      const { data, error } = await supabase
        .from("crm_opportunities" as any)
        .select("*, customers(name)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Crear oportunidad
  const mutation = useMutation({
    mutationFn: async (newOpp: any) => {
      const { error } = await supabase.from("crm_opportunities" as any).insert([newOpp]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities", companyId] });
      setForm({
        name: "",
        description: "",
        value: "",
        probability: 0,
        estimated_close_date: "",
        customer_id: "",
        owner_id: "",
      });
    },
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Oportunidades</h2>
      <form
        className="mb-6 grid gap-2"
        onSubmit={e => {
          e.preventDefault();
          mutation.mutate({
            ...form,
            company_id: companyId,
            value: form.value ? Number(form.value) : null,
            probability: form.probability ? Number(form.probability) : 0,
          });
        }}
      >
        <Input
          placeholder="Nombre de la oportunidad"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
        />
        <Textarea
          placeholder="Descripción"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
        <Input
          placeholder="Valor estimado"
          type="number"
          value={form.value}
          onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
        />
        <Input
          placeholder="Probabilidad (%)"
          type="number"
          value={form.probability}
          onChange={e => setForm(f => ({ ...f, probability: Number(e.target.value) }))}
        />
        <Input
          placeholder="Fecha estimada de cierre"
          type="date"
          value={form.estimated_close_date}
          onChange={e => setForm(f => ({ ...f, estimated_close_date: e.target.value }))}
        />
        {/* Puedes agregar selects para customer_id y owner_id si tienes esos datos */}
        <Button type="submit" disabled={mutation.isPending}>
          Crear oportunidad
        </Button>
      </form>

      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        <ul className="space-y-2">
          {opportunities?.map((opp: any) => (
            <li key={opp.id} className="border rounded p-3">
              <div className="font-semibold">{opp.name}</div>
              <div className="text-sm text-muted-foreground">{opp.description}</div>
              <div>
                <span className="font-mono">Valor: ${opp.value ?? "-"}</span> |{" "}
                <span>Probabilidad: {opp.probability}%</span> |{" "}
                <span>Etapa: {opp.stage}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Cliente: {opp.customers?.name ?? "-"}
              </div>
              <div className="text-xs text-muted-foreground">
                Cierre estimado: {opp.estimated_close_date ?? "-"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}