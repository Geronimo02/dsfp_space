
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface OpportunitiesListProps {
  companyId: string;
  search?: string;
}

export function OpportunitiesList({ companyId, search }: OpportunitiesListProps) {
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

  // Filtro de búsqueda simple por nombre de oportunidad o cliente
  const filtered = (opportunities || []).filter((opp: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      opp.name?.toLowerCase().includes(s) ||
      opp.customers?.name?.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <form
        className="mb-6 grid gap-2 md:grid-cols-2 lg:grid-cols-3 bg-slate-50 p-4 rounded-lg shadow"
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
        <Button type="submit" disabled={mutation.isPending} className="col-span-full md:col-span-2 lg:col-span-1">
          Crear oportunidad
        </Button>
      </form>

      {isLoading ? (
        <p>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">No hay oportunidades que coincidan.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((opp: any) => (
            <div key={opp.id} className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-primary">
                  {opp.customers?.name?.[0] ?? "?"}
                </div>
                <div>
                  <div className="font-semibold text-lg">{opp.name}</div>
                  <div className="text-xs text-muted-foreground">Cliente: {opp.customers?.name ?? "-"}</div>
                </div>
                <span className={
                  "ml-auto px-2 py-0.5 rounded text-xs font-semibold " +
                  (opp.stage === "ganado"
                    ? "bg-green-100 text-green-700"
                    : opp.stage === "perdido"
                    ? "bg-red-100 text-red-700"
                    : opp.stage === "en_proceso"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-slate-100 text-slate-700")
                }>
                  {opp.stage?.replace("_", " ") ?? "-"}
                </span>
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">{opp.description}</div>
              <div className="flex gap-4 text-xs mt-2">
                <span className="font-mono">Valor: ${opp.value ?? "-"}</span>
                <span>Prob: {opp.probability}%</span>
                <span>Cierre: {opp.estimated_close_date ?? "-"}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline">Ver</Button>
                <Button size="sm" variant="secondary">Editar</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}