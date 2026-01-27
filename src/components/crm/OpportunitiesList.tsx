
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface OpportunitiesListProps {
  companyId: string;
  search: string;
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
  const [showForm, setShowForm] = useState(false);

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

  // Filtrar por búsqueda
  const filteredOpportunities = opportunities?.filter((opp: any) => {
    const searchLower = search.toLowerCase();
    return (
      opp.name?.toLowerCase().includes(searchLower) ||
      opp.customers?.name?.toLowerCase().includes(searchLower)
    );
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
      setShowForm(false);
    },
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Oportunidades</h2>
        <Button variant="default" onClick={() => setShowForm(f => !f)}>
          {showForm ? "Cancelar" : "Nueva oportunidad"}
        </Button>
      </div>
      {showForm && (
        <form
          className="mb-6 grid gap-2 bg-gray-50 p-4 rounded-lg border"
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
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Nombre de la oportunidad"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
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
          </div>
          <Textarea
            placeholder="Descripción"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          {/* Puedes agregar selects para customer_id y owner_id si tienes esos datos */}
          <div className="flex justify-end mt-2">
            <Button type="submit" disabled={mutation.isPending}>
              Crear oportunidad
            </Button>
          </div>
        </form>
      )}
      {isLoading ? (
        <p>Cargando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded-lg">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Cliente</th>
                <th className="px-4 py-2 text-left">Valor</th>
                <th className="px-4 py-2 text-left">Probabilidad</th>
                <th className="px-4 py-2 text-left">Etapa</th>
                <th className="px-4 py-2 text-left">Cierre estimado</th>
                <th className="px-4 py-2 text-left">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpportunities?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-muted-foreground">No se encontraron oportunidades.</td>
                </tr>
              ) : (
                filteredOpportunities?.map((opp: any) => (
                  <tr key={opp.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold">{opp.name}</td>
                    <td className="px-4 py-2">{opp.customers?.name ?? "-"}</td>
                    <td className="px-4 py-2 font-mono">${opp.value ?? "-"}</td>
                    <td className="px-4 py-2">{opp.probability}%</td>
                    <td className="px-4 py-2">{opp.stage}</td>
                    <td className="px-4 py-2">{opp.estimated_close_date ?? "-"}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">{opp.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}