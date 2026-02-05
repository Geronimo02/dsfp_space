
import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompany } from "@/contexts/CompanyContext";
import { OpportunitiesList } from "@/components/crm/OpportunitiesList";
import { LucidePlus, LucideFilter, LucideDownload } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// --- Data hooks reutilizables ---
type OpportunityRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];
type OpportunityInsert = Database["public"]["Tables"]["crm_opportunities"]["Insert"];
type OpportunityUpdate = Database["public"]["Tables"]["crm_opportunities"]["Update"];

export function useOpportunitiesQuery(params: {
  companyId: string;
  search?: string;
  filters?: any;
  page?: number;
  pageSize?: number;
  sort?: { field: string; direction: "asc" | "desc" };
}) {
  return useQuery({
    queryKey: ["opportunities", params],
    queryFn: async () => {
      let q = supabase
        .from("crm_opportunities")
        .select("*, customers(name), owner:profiles(name), stage", { count: "exact" })
        .eq("company_id", params.companyId);
      if (params.search) q = q.ilike("name", `%${params.search}%`);
      if (params.filters?.pipelineId) q = q.eq("pipeline_id", params.filters.pipelineId);
      if (params.filters?.ownerId) q = q.eq("owner_id", params.filters.ownerId);
      if (params.filters?.stage) q = q.eq("stage", params.filters.stage);
      if (params.filters?.dateRange) q = q.gte("estimated_close_date", params.filters.dateRange.from).lte("estimated_close_date", params.filters.dateRange.to);
      if (params.filters?.valueRange) q = q.gte("value", params.filters.valueRange.min).lte("value", params.filters.valueRange.max);
      if (params.sort?.field) q = q.order(params.sort.field, { ascending: params.sort.direction === "asc" });
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { data: (data ?? []) as OpportunityRow[], total: count ?? 0 };
    },
    // keepPreviousData: true, // Si usas TanStack Query v5, esta prop ya no existe
    placeholderData: (prev) => prev,
  });
}

export function useCreateOpportunityMutation(companyId: string, onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: OpportunityInsert) => {
      const { error } = await supabase.from("crm_opportunities").insert([
        { ...values, company_id: companyId },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      onSuccess?.();
    },
  });
}

// --- Autocomplete helpers ---
function useAccountsAutocomplete(companyId: string, query: string) {
  return useQuery({
    queryKey: ["accounts-autocomplete", companyId, query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name")
        .eq("company_id", companyId)
        .ilike("name", `%${query}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!query,
  });
}

function useContactsAutocomplete(companyId: string, query: string) {
  return useQuery({
    queryKey: ["contacts-autocomplete", companyId, query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId)
        .ilike("name", `%${query}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!query,
  });
}

// --- Toolbar, Filters, Drawer, and List are composed here ---

export default function OpportunitiesPage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [filters, setFilters] = useState({
    pipelineId: undefined as string | undefined,
    stageId: undefined as string | undefined,
    ownerId: undefined as string | undefined,
    status: undefined as string | undefined,
    dateRange: undefined as { from: string; to: string } | undefined,
    amountRange: undefined as { min: number; max: number } | undefined,
  })

  // Saved views (basic: default + last used in localStorage)
  const [savedView, setSavedView] = useState<string>("default");

  if (!currentCompany) return null;

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Oportunidades</h1>
            {/* Saved Views Dropdown (basic) */}
            <select
              className="ml-2 border rounded px-2 py-1 text-sm"
              value={savedView}
              onChange={e => setSavedView(e.target.value)}
              aria-label="Vista guardada"
            >
              <option value="default">Vista por defecto</option>
              <option value="last">Última vista</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Buscar oportunidad o cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-64"
              aria-label="Buscar"
            />
            <Button variant="outline" size="icon" aria-label="Filtros avanzados">
              <LucideFilter className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Exportar oportunidades">
              <LucideDownload className="w-5 h-5" />
            </Button>
            <Button onClick={() => setShowDrawer(true)} variant="default" className="ml-2">
              <LucidePlus className="w-4 h-4 mr-1" /> Nueva oportunidad
            </Button>
          </div>
        </div>
        {/* TODO: FiltersBar component (pipeline, stage, owner, date/amount range, status) */}
        {/* <FiltersBar filters={filters} onChange={setFilters} /> */}
        <OpportunitiesList
          companyId={currentCompany.id}
          search={search}
          filters={filters}
          onCreate={() => setShowDrawer(true)}
        />
        {/* Drawer/modal for create opportunity */}
        {showDrawer && (
          <CreateOpportunityDrawer
            open={showDrawer}
            onClose={() => setShowDrawer(false)}
            companyId={currentCompany.id}
          />
        )}

      </div>
    </Layout>
  )};


// --- CreateOpportunityDrawer ---
const opportunitySchema = z.object({
  name: z.string().min(2, "Requerido"),
  pipeline_id: z.string().min(1, "Requerido"),
  stage: z.string().min(1, "Requerido"),
  customer_id: z.string().min(1, "Requerido"),
  value: z.number().min(0.01, "Monto requerido"),
  currency: z.string().default("ARS"),
  estimated_close_date: z.string().min(1, "Requerido"),
  probability: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  owner_id: z.string().optional(),
  company_id: z.string().min(1, "Requerido"),
});

type OpportunityForm = z.infer<typeof opportunitySchema>;

function CreateOpportunityDrawer({ open, onClose, companyId }: { open: boolean; onClose: () => void; companyId: string }) {
  const currentUserId = undefined; // TODO: fetch from supabase.auth.getUser()
  const form = useForm<OpportunityForm>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      probability: 50,
      owner_id: currentUserId,
      company_id: companyId,
    },
    mode: "onChange",
  });
  const mutation = useCreateOpportunityMutation(companyId, () => {
    toast.success("Oportunidad creada");
    onClose();
  });

  // --- Autocomplete cuentas/contactos ---
  const [accountQuery, setAccountQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const customerId = form.watch("customer_id");
  const { data: accounts = [] } = useAccountsAutocomplete(companyId, accountQuery);
  const { data: contacts = [] } = useContactsAutocomplete(companyId, contactQuery);

  // --- AI Assist stub ---
  function handleAIAssist() {
    form.setValue("description", "Sugerencia generada por IA: revisar documentación enviada y agendar demo.");
  }

  useEffect(() => {
    if (open) form.reset();
  }, [open]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white h-full shadow-xl animate-in slide-in-from-right duration-300 outline-none flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Nueva oportunidad</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            ×
          </Button>
        </div>
        <form
          className="flex-1 overflow-y-auto p-4 grid gap-4"
          onSubmit={form.handleSubmit(values => {
            // Forzar que los campos requeridos estén presentes y no opcionales
            const { name, pipeline_id, stage, customer_id, value, estimated_close_date, probability, description, owner_id, currency } = values;
            const payload: OpportunityInsert = {
              company_id: companyId,
              name: name!,
              customer_id: customer_id!,
              // pipeline_id y stage pueden ser opcionales según el tipo, pero si son requeridos, forzar
              pipeline_id: pipeline_id ?? null,
              stage: stage!,
              value: value ?? null,
              estimated_close_date: estimated_close_date ?? null,
              probability: probability ?? null,
              description: description ?? null,
              owner_id: owner_id ?? null,
              // currency no está en el tipo Insert, pero si tu tabla lo tiene, agrégalo aquí
            };
            mutation.mutate(payload);
          })}
        >
          <div className="grid gap-2">
            <label className="font-medium">Nombre *</label>
            <Input {...form.register("name")} autoFocus aria-invalid={!!form.formState.errors.name} />
            {form.formState.errors.name && <span className="text-xs text-red-500">{form.formState.errors.name.message}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Pipeline *</label>
              <Input {...form.register("pipeline_id")} aria-invalid={!!form.formState.errors.pipeline_id} />
              {/* TODO: Select real pipeline */}
              {form.formState.errors.pipeline_id && <span className="text-xs text-red-500">{form.formState.errors.pipeline_id.message}</span>}
            </div>
            <div>
              <label className="font-medium">Etapa *</label>
              <Input {...form.register("stage")} aria-invalid={!!form.formState.errors.stage} />
              {/* TODO: Select real stage */}
              {form.formState.errors.stage && <span className="text-xs text-red-500">{form.formState.errors.stage.message}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Cuenta *</label>
              <Input
                {...form.register("customer_id")}
                aria-invalid={!!form.formState.errors.customer_id}
                list="accounts-list"
                onChange={e => {
                  form.setValue("customer_id", e.target.value);
                  setAccountQuery(e.target.value);
                }}
              />
              <datalist id="accounts-list">
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </datalist>
              {form.formState.errors.customer_id && <span className="text-xs text-red-500">{form.formState.errors.customer_id.message}</span>}
            </div>
            <div>
              <label className="font-medium">Contacto</label>
              <Input
                {...form.register("customer_id")}
                list="contacts-list"
                onChange={e => {
                  form.setValue("customer_id", e.target.value);
                  setContactQuery(e.target.value);
                }}
              />
              <datalist id="contacts-list">
                {contacts.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Monto *</label>
              <Input type="number" step="0.01" {...form.register("value", { valueAsNumber: true })} aria-invalid={!!form.formState.errors.value} />
              {form.formState.errors.value && <span className="text-xs text-red-500">{form.formState.errors.value.message}</span>}
            </div>
            <div>
              <label className="font-medium">Moneda</label>
              <Input {...form.register("currency")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Cierre *</label>
              <Input type="date" {...form.register("estimated_close_date")} aria-invalid={!!form.formState.errors.estimated_close_date} />
              {form.formState.errors.estimated_close_date && <span className="text-xs text-red-500">{form.formState.errors.estimated_close_date.message}</span>}
            </div>
            <div>
              <label className="font-medium">Probabilidad (%)</label>
              <Input type="number" {...form.register("probability", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="font-medium">Notas</label>
            <textarea {...form.register("description")} className="border rounded px-2 py-1 min-h-[60px]" />
          </div>
          <div className="flex gap-2 items-center mt-2">
            <Button type="button" variant="outline" onClick={handleAIAssist}>AI Assist</Button>
            <Button type="submit" disabled={!form.formState.isValid || mutation.isPending}>
              Crear oportunidad
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
