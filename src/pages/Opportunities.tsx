
import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/contexts/CompanyContext";
import { OpportunitiesList } from "@/components/crm/OpportunitiesList";
import { OpportunityDrawer } from "@/components/crm/OpportunityDrawer";
import { LucidePlus, LucideFilter, LucideDownload } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { opportunityService } from "@/domain/crm/services/opportunityService";
import type { OpportunityDTO } from "@/domain/crm/dtos/opportunity";
import * as XLSX from "xlsx";

// --- Data hooks reutilizables ---
type OpportunityRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];
type OpportunityInsert = Database["public"]["Tables"]["crm_opportunities"]["Insert"];
type OpportunityInsertExtended = OpportunityInsert & {
  status?: string | null;
  close_date?: string | null;
  closed_at?: string | null;
  lost_reason?: string | null;
  won_reason?: string | null;
  source?: string | null;
  currency?: string | null;
  expected_revenue?: number | null;
  next_step?: string | null;
  last_activity_at?: string | null;
  tags?: string[] | null;
};
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
        .select("*, customers(name), owner:employees(first_name,last_name), stage", { count: "exact" })
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
    mutationFn: async (values: OpportunityInsertExtended) => {
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
        .select("id, first_name, last_name")
        .eq("company_id", companyId)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!query,
  });
}

function useCustomersAutocomplete(companyId: string, query: string) {
  return useQuery({
    queryKey: ["customers-autocomplete", companyId, query],
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [filters, setFilters] = useState({
    pipelineId: undefined as string | undefined,
    stageId: undefined as string | undefined,
    ownerId: undefined as string | undefined,
    status: undefined as string | undefined,
    dateRange: undefined as { from: string; to: string } | undefined,
    value: undefined as { min: number; max: number } | undefined,
  })

  const [savedViewId, setSavedViewId] = useState<string>("default");
  const [newViewName, setNewViewName] = useState("");

  const { data: savedViews = [] } = useQuery({
    queryKey: ["crm-saved-views", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_saved_views")
        .select("id, name, filters")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ["crm-pipelines", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("id, name, stages")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: owners = [] } = useQuery({
    queryKey: ["crm-owners", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("company_id", currentCompany?.id)
        .order("first_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const stageOptions = useMemo(() => {
    if (filters.pipelineId) {
      const pipeline = pipelines.find((p: any) => p.id === filters.pipelineId);
      return pipeline?.stages ?? [];
    }
    const allStages = pipelines.flatMap((p: any) => p.stages || []);
    return Array.from(new Set(allStages));
  }, [filters.pipelineId, pipelines]);

  const createSavedViewMutation = useMutation({
    mutationFn: async () => {
      if (!newViewName.trim() || !currentCompany?.id) {
        throw new Error("Nombre de vista requerido");
      }
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        throw new Error("Usuario no autenticado");
      }
      const { error } = await supabase.from("crm_saved_views").insert([
        {
          company_id: currentCompany.id,
          user_id: userId,
          name: newViewName.trim(),
          filters: { ...filters, search },
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-saved-views", currentCompany?.id] });
      setNewViewName("");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextFilters: any = {
      pipelineId: params.get("pipelineId") || undefined,
      stageId: params.get("stageId") || undefined,
      ownerId: params.get("ownerId") || undefined,
      status: params.get("status") || undefined,
    };
    const dateFrom = params.get("dateFrom");
    const dateTo = params.get("dateTo");
    if (dateFrom && dateTo) {
      nextFilters.dateRange = { from: dateFrom, to: dateTo };
    }
    const valueMin = params.get("valueMin");
    const valueMax = params.get("valueMax");
    if (valueMin && valueMax) {
      nextFilters.value = { min: Number(valueMin), max: Number(valueMax) };
    }
    setFilters((prev) => ({ ...prev, ...nextFilters }));
    const searchParam = params.get("search");
    if (searchParam !== null) setSearch(searchParam);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filters.pipelineId) params.set("pipelineId", filters.pipelineId);
    if (filters.stageId) params.set("stageId", filters.stageId);
    if (filters.ownerId) params.set("ownerId", filters.ownerId);
    if (filters.status) params.set("status", filters.status);
    if (filters.dateRange?.from) params.set("dateFrom", filters.dateRange.from);
    if (filters.dateRange?.to) params.set("dateTo", filters.dateRange.to);
    if (filters.value?.min !== undefined) params.set("valueMin", String(filters.value.min));
    if (filters.value?.max !== undefined) params.set("valueMax", String(filters.value.max));

    const queryString = params.toString();
    const nextUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [search, filters]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    queryClient.prefetchQuery({
      queryKey: ["crm-pipelines", currentCompany.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("crm_pipelines")
          .select("id, name, stages")
          .eq("company_id", currentCompany.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      },
    });
    queryClient.prefetchQuery({
      queryKey: ["crm-owners", currentCompany.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("employees")
          .select("id, first_name, last_name")
          .eq("company_id", currentCompany.id)
          .order("first_name", { ascending: true });
        if (error) throw error;
        return data || [];
      },
    });
    queryClient.prefetchQuery({
      queryKey: ["crm-tags", currentCompany.id],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("crm_tags")
          .select("id, name, color")
          .eq("company_id", currentCompany.id)
          .order("name", { ascending: true });
        if (error) throw error;
        return data || [];
      },
    });
  }, [currentCompany?.id, queryClient]);

  if (!currentCompany) return null;

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  };

  const buildExportRows = (rows: OpportunityDTO[]) =>
    rows.map((row) => ({
      Oportunidad: row.name,
      Etapa: row.stage,
      Monto: row.value ?? "",
      Cierre: formatDate(row.estimatedCloseDate),
      Probabilidad: row.probability ?? "",
      "Próximo paso": row.nextStep ?? "",
      "Última actividad": formatDate(row.lastActivityAt),
    }));

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    try {
      const result = await opportunityService.list({
        companyId: currentCompany.id,
        search,
        filters,
        page: 1,
        pageSize: 10000,
      });

      const rows = buildExportRows(result.data);
      if (rows.length === 0) {
        toast.error("No hay oportunidades para exportar");
        return;
      }

      if (format === "csv") {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "oportunidades.csv");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Oportunidades");
      const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      downloadBlob(
        new Blob([arrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "oportunidades.xlsx"
      );
    } catch (error: any) {
      toast.error(error.message || "Error al exportar oportunidades");
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Oportunidades</h1>
            <select
              className="ml-2 border rounded px-2 py-1 text-sm"
              value={savedViewId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSavedViewId(nextId);
                if (nextId === "default") return;
                const view = savedViews.find((v) => v.id === nextId);
                if (view?.filters) {
                  const nextFilters = view.filters as any;
                  const nextValue = nextFilters.value ?? nextFilters.amountRange;
                  setFilters({
                    pipelineId: nextFilters.pipelineId,
                    stageId: nextFilters.stageId,
                    ownerId: nextFilters.ownerId,
                    status: nextFilters.status,
                    dateRange: nextFilters.dateRange,
                    value: nextValue,
                  });
                  if (typeof nextFilters.search === "string") {
                    setSearch(nextFilters.search);
                  }
                }
              }}
              aria-label="Vista guardada"
            >
              <option value="default">Vista por defecto</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Exportar oportunidades">
                  <LucideDownload className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                  Exportar XLSX
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setShowDrawer(true)} variant="default" className="ml-2">
              <LucidePlus className="w-4 h-4 mr-1" /> Nueva oportunidad
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="Nombre de vista"
            className="w-56"
          />
          <Button
            variant="outline"
            onClick={() => createSavedViewMutation.mutate()}
            disabled={!newViewName.trim() || createSavedViewMutation.isPending}
          >
            Guardar vista
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <Select
            value={filters.pipelineId || "all"}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                pipelineId: value === "all" ? undefined : value,
                stageId: undefined,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pipelines</SelectItem>
              {pipelines.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.stageId || "all"}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                stageId: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etapas</SelectItem>
              {stageOptions.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.ownerId || "all"}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                ownerId: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {owners.map((o: any) => (
                <SelectItem key={o.id} value={o.id}>
                  {`${o.first_name} ${o.last_name}`.trim()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status || "all"}
            onValueChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status: value === "all" ? undefined : value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="abierta">Abierta</SelectItem>
              <SelectItem value="ganado">Ganado</SelectItem>
              <SelectItem value="perdido">Perdido</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.dateRange?.from || ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: {
                  from: e.target.value,
                  to: prev.dateRange?.to || e.target.value,
                },
              }))
            }
            placeholder="Desde"
          />
          <Input
            type="date"
            value={filters.dateRange?.to || ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: {
                  from: prev.dateRange?.from || e.target.value,
                  to: e.target.value,
                },
              }))
            }
            placeholder="Hasta"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input
            type="number"
            value={filters.value?.min ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                value: {
                  min: e.target.value ? Number(e.target.value) : 0,
                  max: prev.value?.max ?? 0,
                },
              }))
            }
            placeholder="Monto mínimo"
          />
          <Input
            type="number"
            value={filters.value?.max ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                value: {
                  min: prev.value?.min ?? 0,
                  max: e.target.value ? Number(e.target.value) : 0,
                },
              }))
            }
            placeholder="Monto máximo"
          />
          <Button
            variant="outline"
            onClick={() =>
              setFilters({
                pipelineId: undefined,
                stageId: undefined,
                ownerId: undefined,
                status: undefined,
                dateRange: undefined,
                value: undefined,
              })
            }
          >
            Limpiar filtros
          </Button>
        </div>
        <OpportunitiesList
          companyId={currentCompany.id}
          search={search}
          filters={filters}
          onCreate={() => setShowDrawer(true)}
        />
        {/* Drawer/modal for create opportunity */}
        <OpportunityDrawer
          open={showDrawer}
          onClose={() => setShowDrawer(false)}
          companyId={currentCompany.id}
          opportunity={null}
        />

      </div>
    </Layout>
  )};


// --- CreateOpportunityDrawer ---
const opportunitySchema = z.object({
  name: z.string().min(2, "Requerido"),
  pipeline_id: z.string().min(1, "Requerido"),
  stage: z.string().min(1, "Requerido"),
  customer_id: z.string().optional(),
  value: z.number().min(0.01, "Monto requerido").optional(),
  currency: z.string().default("ARS"),
  estimated_close_date: z.string().min(1, "Requerido"),
  probability: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  owner_id: z.string().optional(),
  status: z.string().default("abierta"),
  close_date: z.string().optional(),
  lost_reason: z.string().optional(),
  won_reason: z.string().optional(),
  source: z.string().optional(),
  expected_revenue: z.number().optional(),
  next_step: z.string().optional(),
  tags: z.string().optional(),
});

type OpportunityForm = z.infer<typeof opportunitySchema>;

function CreateOpportunityDrawer({ open, onClose, companyId }: { open: boolean; onClose: () => void; companyId: string }) {
  const form = useForm<OpportunityForm>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      probability: 50,
      status: "abierta",
      currency: "ARS",
      owner_id: undefined,
    },
    mode: "onChange",
  });
  const mutation = useCreateOpportunityMutation(companyId, () => {
    toast.success("Oportunidad creada");
    onClose();
  });

  // --- Autocomplete cuentas/contactos ---
  const [customerQuery, setCustomerQuery] = useState("");
  const { data: customers = [] } = useCustomersAutocomplete(companyId, customerQuery);

  const { data: pipelines = [] } = useQuery({
    queryKey: ["crm-pipelines", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("id, name, stages")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: owners = [] } = useQuery({
    queryKey: ["crm-owners", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("company_id", companyId)
        .order("first_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const selectedPipelineId = form.watch("pipeline_id");
  const selectedPipeline = useMemo(
    () => pipelines.find((p: any) => p.id === selectedPipelineId),
    [pipelines, selectedPipelineId]
  );
  const pipelineStages: string[] = selectedPipeline?.stages ?? [];

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
            const {
              name,
              pipeline_id,
              stage,
              customer_id,
              value,
              estimated_close_date,
              probability,
              description,
              owner_id,
              status,
              close_date,
              lost_reason,
              won_reason,
              source,
              currency,
              expected_revenue,
              next_step,
              tags,
            } = values;
            const payload: OpportunityInsertExtended = {
              company_id: companyId,
              name: name!,
              customer_id: customer_id ?? null,
              // pipeline_id y stage pueden ser opcionales según el tipo, pero si son requeridos, forzar
              pipeline_id: pipeline_id ?? null,
              stage: stage!,
              value: value ?? null,
              estimated_close_date: estimated_close_date ?? null,
              probability: probability ?? null,
              description: description ?? null,
              owner_id: owner_id ?? null,
              status: status ?? null,
              close_date: close_date ?? null,
              lost_reason: lost_reason ?? null,
              won_reason: won_reason ?? null,
              source: source ?? null,
              currency: currency ?? null,
              expected_revenue: expected_revenue ?? null,
              next_step: next_step ?? null,
              tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : null,
            };
            mutation.mutate(payload);
          })}
        >
          <div className="text-xs text-muted-foreground">
            Los campos con * son obligatorios.
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Datos básicos</div>
          <div className="grid gap-2">
            <label className="font-medium">Nombre *</label>
            <Input
              {...form.register("name")}
              autoFocus
              placeholder="Ej: Renovación contrato ACME"
              aria-invalid={!!form.formState.errors.name}
            />
            {form.formState.errors.name && <span className="text-xs text-red-500">{form.formState.errors.name.message}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Pipeline *</label>
              <Select
                value={form.watch("pipeline_id") || ""}
                onValueChange={(value) => {
                  form.setValue("pipeline_id", value, { shouldValidate: true });
                  const pipeline = pipelines.find((p: any) => p.id === value);
                  const nextStage = pipeline?.stages?.[0];
                  if (nextStage) {
                    form.setValue("stage", nextStage, { shouldValidate: true });
                  }
                }}
              >
                <SelectTrigger aria-invalid={!!form.formState.errors.pipeline_id}>
                  <SelectValue placeholder="Elegí un pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.pipeline_id && <span className="text-xs text-red-500">{form.formState.errors.pipeline_id.message}</span>}
              <p className="text-xs text-muted-foreground">Define las etapas disponibles.</p>
            </div>
            <div>
              <label className="font-medium">Etapa *</label>
              <Select
                value={form.watch("stage") || ""}
                onValueChange={(value) => form.setValue("stage", value, { shouldValidate: true })}
                disabled={!pipelineStages.length}
              >
                <SelectTrigger aria-invalid={!!form.formState.errors.stage}>
                  <SelectValue placeholder={pipelineStages.length ? "Seleccionar etapa" : "Elegí un pipeline"} />
                </SelectTrigger>
                <SelectContent>
                  {pipelineStages.map((stage: string) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.stage && <span className="text-xs text-red-500">{form.formState.errors.stage.message}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Cliente</label>
              <Select
                value={form.watch("customer_id") || "__none__"}
                onValueChange={(value) => {
                  form.setValue("customer_id", value === "__none__" ? undefined : value, { shouldValidate: true });
                  setCustomerQuery("");
                }}
              >
                <SelectTrigger aria-invalid={!!form.formState.errors.customer_id}>
                  <SelectValue placeholder="Elegí un cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin cliente</SelectItem>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.customer_id && <span className="text-xs text-red-500">{form.formState.errors.customer_id.message}</span>}
              <p className="text-xs text-muted-foreground">Si no hay cliente, dejalo en “Sin cliente”.</p>
            </div>
            <div>
              <label className="font-medium">Responsable</label>
              <Select
                value={form.watch("owner_id") || "__none__"}
                onValueChange={(value) =>
                  form.setValue("owner_id", value === "__none__" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Asignar responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin responsable</SelectItem>
                  {owners.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {[o.first_name, o.last_name].filter(Boolean).join(" ") || "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Monto y fechas</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Monto</label>
              <Input type="number" step="0.01" {...form.register("value", { valueAsNumber: true })} aria-invalid={!!form.formState.errors.value} />
              {form.formState.errors.value && <span className="text-xs text-red-500">{form.formState.errors.value.message}</span>}
            </div>
            <div>
              <label className="font-medium">Moneda</label>
              <Select
                value={form.watch("currency") || "ARS"}
                onValueChange={(value) => form.setValue("currency", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                  <SelectItem value="USD">USD - Dólar</SelectItem>
                  <SelectItem value="BRL">BRL - Real Brasileño</SelectItem>
                  <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                  <SelectItem value="CLP">CLP - Peso Chileno</SelectItem>
                  <SelectItem value="COP">COP - Peso Colombiano</SelectItem>
                  <SelectItem value="PEN">PEN - Sol Peruano</SelectItem>
                  <SelectItem value="UYU">UYU - Peso Uruguayo</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Cierre estimado *</label>
              <Input type="date" {...form.register("estimated_close_date")} aria-invalid={!!form.formState.errors.estimated_close_date} />
              {form.formState.errors.estimated_close_date && <span className="text-xs text-red-500">{form.formState.errors.estimated_close_date.message}</span>}
            </div>
            <div>
              <label className="font-medium">Probabilidad (%)</label>
              <Input type="number" {...form.register("probability", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Estado y seguimiento</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Estado</label>
              <Select
                value={form.watch("status") || "abierta"}
                onValueChange={(value) => form.setValue("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abierta">Abierta</SelectItem>
                  <SelectItem value="ganado">Ganado</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-medium">Fecha de cierre real</label>
              <Input type="date" {...form.register("close_date")} />
              <p className="text-xs text-muted-foreground">Solo si se ganó o perdió.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Fuente</label>
              <Input {...form.register("source")} placeholder="Ej: Referido, Web, Ads" />
            </div>
            <div>
              <label className="font-medium">Ingreso esperado</label>
              <Input type="number" step="0.01" {...form.register("expected_revenue", { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid gap-2">
            <label className="font-medium">Próximo paso</label>
            <Input {...form.register("next_step")} placeholder="Ej: Llamar el martes" />
          </div>
          <div className="grid gap-2">
            <label className="font-medium">Motivo ganado</label>
            <Input {...form.register("won_reason")} placeholder="Opcional" />
            <p className="text-xs text-muted-foreground">Completar solo si se ganó.</p>
          </div>
          <div className="grid gap-2">
            <label className="font-medium">Motivo perdido</label>
            <Input {...form.register("lost_reason")} placeholder="Opcional" />
            <p className="text-xs text-muted-foreground">Completar solo si se perdió.</p>
          </div>
          <div className="grid gap-2">
            <label className="font-medium">Tags (separadas por coma)</label>
            <Input {...form.register("tags")} placeholder="Ej: upsell, prioridad-alta" />
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Notas</div>
          <div className="grid gap-2">
            <label className="font-medium">Notas</label>
            <textarea
              {...form.register("description")}
              className="border rounded px-2 py-1 min-h-[60px]"
              placeholder="Escribí un resumen corto de la oportunidad"
            />
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
