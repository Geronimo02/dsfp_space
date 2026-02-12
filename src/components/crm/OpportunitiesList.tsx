import type { Database } from "@/integrations/supabase/types";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LucideMoreVertical, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { OpportunityDrawer } from "./OpportunityDrawer";
import { opportunityService } from "@/domain/crm/services/opportunityService";
import type { OpportunityDTO } from "@/domain/crm/dtos/opportunity";
import { pipelineService } from "@/domain/crm/services/pipelineService";
import { tagService } from "@/domain/crm/services/tagService";

// --- Types ---
type SortableField = keyof Omit<Database["public"]["Tables"]["crm_opportunities"]["Row"], "closed_at" | "close_date" | "currency" | "expected_revenue" | "last_activity_at" | "lost_reason" | "next_step" | "source" | "status" | "tags" | "won_reason">;
type OpportunityRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];

interface OpportunitiesListProps {
  companyId: string;
  search: string;
  filters: {
    pipelineId?: string;
    stageId?: string;
    ownerId?: string;
    status?: string;
    dateRange?: { from: string; to: string };
    value?: { min: number; max: number };
  };
  onCreate?: () => void;
}

type OpportunitiesQueryResult = {
  data: OpportunityDTO[];
  total: number;
};

// Only allow sorting by real columns (and optionally custom ones)

export function OpportunitiesList({
  companyId,
  search,
  filters,
  onCreate,
}: OpportunitiesListProps) {
  const queryClient = useQueryClient();
  const [editingOpportunity, setEditingOpportunity] = useState<OpportunityRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<string>("");
  const [bulkOwner, setBulkOwner] = useState<string>("");
  const [bulkTag, setBulkTag] = useState<string>("");
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  
  // --- Pagination & Sorting ---
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [sort, setSort] = useState<{ field: SortableField; direction: "asc" | "desc" }>(
    { field: "close_date", direction: "desc" } as any
  );

  useEffect(() => {
    const stored = localStorage.getItem(`crm:oppSelection:${companyId}`);
    if (!stored) return;
    try {
      const ids = JSON.parse(stored) as string[];
      setSelectedIds(new Set(ids));
    } catch {
      setSelectedIds(new Set());
    }
  }, [companyId]);

  useEffect(() => {
    localStorage.setItem(
      `crm:oppSelection:${companyId}`,
      JSON.stringify(Array.from(selectedIds))
    );
  }, [companyId, selectedIds]);

  // --- Stable query key (NO complex object) ---
  const normalizedFilters = useMemo(() => {
    const pipelineId = filters.pipelineId?.trim() || undefined;
    const stageId = filters.stageId?.trim() || undefined;
    const ownerId = filters.ownerId?.trim() || undefined;
    const status = filters.status?.trim() || undefined;

    const from = filters.dateRange?.from?.trim() || "";
    const to = filters.dateRange?.to?.trim() || "";
    const dateRange = from && to ? { from, to } : undefined;

    const min = Number.isFinite(filters.value?.min) ? filters.value!.min : undefined;
    const max = Number.isFinite(filters.value?.max) ? filters.value!.max : undefined;
    const value = min != null && max != null ? { min, max } : undefined;

    return {
      pipelineId,
      stageId,
      ownerId,
      status,
      dateRange,
      value,
    };
  }, [
    filters.pipelineId,
    filters.stageId,
    filters.ownerId,
    filters.status,
    filters.dateRange?.from,
    filters.dateRange?.to,
    filters.value?.min,
    filters.value?.max,
  ]);

  const queryKey = useMemo(
    () =>
      [
        "opportunities",
        companyId,
        search ?? "",
        normalizedFilters.pipelineId ?? "",
        normalizedFilters.stageId ?? "",
        normalizedFilters.ownerId ?? "",
        normalizedFilters.status ?? "",
        normalizedFilters.dateRange?.from ?? "",
        normalizedFilters.dateRange?.to ?? "",
        normalizedFilters.value?.min ?? "",
        normalizedFilters.value?.max ?? "",
        sort.field,
        sort.direction,
        page,
        pageSize,
      ] as const,
    [
      companyId,
      search,
      normalizedFilters.pipelineId,
      normalizedFilters.stageId,
      normalizedFilters.ownerId,
      normalizedFilters.status,
      normalizedFilters.dateRange?.from,
      normalizedFilters.dateRange?.to,
      normalizedFilters.value?.min,
      normalizedFilters.value?.max,
      sort.field,
      sort.direction,
      page,
      pageSize,
    ]
  );

  const toOpportunityRow = (dto: OpportunityDTO): OpportunityRow => ({
    id: dto.id,
    company_id: dto.companyId,
    name: dto.name,
    email: dto.email,
    phone: dto.phone,
    customer_id: dto.customerId,
    pipeline_id: dto.pipelineId,
    stage: dto.stage,
    value: dto.value,
    estimated_close_date: dto.estimatedCloseDate,
    probability: dto.probability,
    description: dto.description,
    owner_id: dto.ownerId,
    status: dto.status ?? "abierta",
    close_date: dto.closeDate,
    lost_reason: dto.lostReason,
    won_reason: dto.wonReason,
    source: dto.source,
    currency: dto.currency,
    expected_revenue: dto.expectedRevenue,
    next_step: dto.nextStep,
    last_activity_at: dto.lastActivityAt,
    sla_due_at: dto.slaDueAt,
    score_total: dto.scoreTotal ?? 0,
    score_updated_at: dto.scoreUpdatedAt,
    tags: dto.tags,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
    closed_at: null,
  });

  // --- Data fetching ---
  const { data, isLoading, isError, refetch, isFetching } = useQuery<
    OpportunitiesQueryResult,
    Error
  >({
    queryKey,
    queryFn: async (): Promise<OpportunitiesQueryResult> => {
      return opportunityService.list({
        companyId,
        search,
        filters: normalizedFilters,
        sort,
        page,
        pageSize,
      });
    },

    enabled: !!companyId,

    // TanStack Query v4:
    placeholderData: (prev) => prev,
  });

  const { data: pipelines = [] } = useQuery({
    queryKey: ["crm-pipelines", companyId],
    queryFn: () => pipelineService.list(companyId),
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

  const { data: tags = [] } = useQuery({
    queryKey: ["crm-tags", companyId],
    queryFn: () => tagService.list(companyId),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const stageOptions = useMemo(() => {
    if (normalizedFilters.pipelineId) {
      const pipeline = pipelines.find((p: any) => p.id === normalizedFilters.pipelineId);
      return pipeline?.stages ?? [];
    }
    const allStages = pipelines.flatMap((p: any) => p.stages || []);
    return Array.from(new Set(allStages));
  }, [normalizedFilters.pipelineId, pipelines]);

  const rows = data?.data ?? [];
  const tableParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableParentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  // Delete opportunity mutation
  const deleteOpportunityMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      await opportunityService.remove(opportunityId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", companyId] });
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      toast.success("Oportunidad eliminada");
    },
    onError: () => {
      toast.error("Error al eliminar oportunidad");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("crm_opportunities").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", companyId] });
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      setSelectedIds(new Set());
    },
  });

  const bulkEditMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };

      if (bulkStage) updates.stage = bulkStage;
      if (bulkOwner) updates.owner_id = bulkOwner;
      if (bulkTag) updates.tags = [bulkTag];

      if (!bulkStage && !bulkOwner && !bulkTag) {
        throw new Error("Seleccioná al menos un cambio para aplicar");
      }

      const { error } = await supabase
        .from("crm_opportunities")
        .update(updates)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", companyId] });
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      setSelectedIds(new Set());
      setBulkStage("");
      setBulkOwner("");
      setBulkTag("");
      setBulkModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al aplicar cambios masivos");
    },
  });

  const handleDeleteOpportunity = (opportunityId: string, opportunityName: string) => {
    if (confirm(`¿Eliminar la oportunidad "${opportunityName}"?`)) {
      deleteOpportunityMutation.mutate(opportunityId);
    }
  };

  // --- Table columns ---
  const columns: { key: keyof OpportunityRow | "actions"; label: string }[] = [
    { key: "name", label: "Oportunidad" },
    { key: "score_total", label: "Score" },
    { key: "stage", label: "Etapa" },
    { key: "value", label: "Monto" },
    { key: "estimated_close_date", label: "Cierre" },
    { key: "probability", label: "%" },
    { key: "next_step", label: "Próximo paso" },
    { key: "last_activity_at", label: "Última actividad" },
    { key: "actions", label: "" },
  ];

  const handleSort = (key: keyof OpportunityRow | "actions") => {
    if (key === "actions") return;

    // only allow sorting by real DB columns (numeric, string, date)
    const sortableFields: (keyof OpportunityRow)[] = [
      "id", "company_id", "customer_id", "name", "value", "stage", 
      "probability", "estimated_close_date", "owner_id", "created_at", 
      "updated_at", "pipeline_id", "description", "score_total"
    ];
    if (!sortableFields.includes(key as keyof OpportunityRow)) {
      return;
    }

    setSort((s) => ({
      field: key as SortableField,
      direction: s.field === key && s.direction === "desc" ? "asc" : "desc",
    }));
    setPage(1);
  };

  const allIds = data?.data?.map((opp) => opp.id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const selectedOpportunities = data?.data?.filter((opp) => selectedIds.has(opp.id)) ?? [];
  const selectedOwnerName = owners.find((o: any) => o.id === bulkOwner)
    ? `${owners.find((o: any) => o.id === bulkOwner)?.first_name} ${owners.find((o: any) => o.id === bulkOwner)?.last_name}`.trim()
    : "";

  return (
    <div className="bg-white rounded-lg shadow p-0">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-gray-50">
          <span className="text-sm">Seleccionadas: {selectedIds.size}</span>
          <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Edición masiva
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edición masiva</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Se aplicará a {selectedIds.size} oportunidades.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium">Etapa</label>
                    <Select value={bulkStage} onValueChange={setBulkStage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Cambiar etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {stageOptions.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stage}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium">Responsable</label>
                    <Select value={bulkOwner} onValueChange={setBulkOwner}>
                      <SelectTrigger>
                        <SelectValue placeholder="Cambiar responsable" />
                      </SelectTrigger>
                      <SelectContent>
                        {owners.map((o: any) => (
                          <SelectItem key={o.id} value={o.id}>
                            {`${o.first_name} ${o.last_name}`.trim()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium">Tag</label>
                    <Select value={bulkTag} onValueChange={setBulkTag}>
                      <SelectTrigger>
                        <SelectValue placeholder="Cambiar tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map((t: any) => (
                          <SelectItem key={t.id} value={t.name}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold">Preview de cambios</div>
                  {bulkStage && <div>Etapa: {bulkStage}</div>}
                  {bulkOwner && <div>Responsable: {selectedOwnerName}</div>}
                  {bulkTag && <div>Tag: {bulkTag}</div>}
                  {!bulkStage && !bulkOwner && !bulkTag && (
                    <div className="text-muted-foreground">
                      Seleccioná al menos un cambio.
                    </div>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold">Oportunidades</div>
                  <div className="max-h-32 overflow-y-auto border rounded p-2">
                    {selectedOpportunities.map((opp) => (
                      <div key={opp.id} className="truncate">
                        {opp.name}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setBulkModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => bulkEditMutation.mutate()}
                    disabled={!bulkStage && !bulkOwner && !bulkTag}
                  >
                    Aplicar cambios
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("¿Eliminar oportunidades seleccionadas?")) {
                bulkDeleteMutation.mutate();
              }
            }}
          >
            Eliminar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpiar selección
          </Button>
        </div>
      )}
      <div ref={tableParentRef} className="overflow-auto max-h-[600px]">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(allIds));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  aria-label="Seleccionar todo"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-2 text-left font-semibold text-sm select-none cursor-pointer"
                  onClick={() => handleSort(col.key)}
                  aria-sort={
                    col.key !== "actions" && sort.field === col.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {col.label}
                  {col.key !== "actions" && sort.field === col.key && (
                    <span className="ml-1 text-xs">{sort.direction === "asc" ? "▲" : "▼"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody
            style={{
              position: "relative",
              height: rows.length ? `${rowVirtualizer.getTotalSize()}px` : undefined,
            }}
          >
            {isLoading || isFetching ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-4" />
                  </td>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data?.data?.length ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-12">
                  <div className="text-muted-foreground mb-2">Aún no hay oportunidades.</div>
                  <Button onClick={onCreate}>Crear oportunidad</Button>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-8">
                  <div className="text-red-500 mb-2">Error al cargar oportunidades.</div>
                  <Button variant="outline" onClick={() => refetch()}>
                    Reintentar
                  </Button>
                </td>
              </tr>
            ) : (
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const opp = rows[virtualRow.index];
                if (!opp) return null;
                return (
                  <tr
                    key={opp.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="border-b hover:bg-gray-50 group"
                    style={{
                      position: "absolute",
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                      display: "table",
                      tableLayout: "fixed",
                    }}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(opp.id)}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) {
                            next.add(opp.id);
                          } else {
                            next.delete(opp.id);
                          }
                          setSelectedIds(next);
                        }}
                        aria-label={`Seleccionar ${opp.name}`}
                      />
                    </td>
                    <td className="px-4 py-2 font-semibold max-w-xs truncate">
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => setEditingOpportunity(toOpportunityRow(opp))}
                      >
                        {opp.name}
                      </button>
                    </td>

                    <td className="px-4 py-2 font-mono">
                      {opp.scoreTotal ?? 0}
                    </td>

                    <td className="px-4 py-2">
                      {opp.stage ? <Badge variant="secondary">{opp.stage}</Badge> : <Badge variant="secondary">-</Badge>}
                    </td>

                    <td className="px-4 py-2 font-mono">{opp.value ? `$${opp.value}` : "-"}</td>

                    <td className="px-4 py-2">
                      {opp.estimatedCloseDate ? format(new Date(opp.estimatedCloseDate), "dd/MM/yyyy") : "-"}
                    </td>

                    <td className="px-4 py-2">{opp.probability ?? "-"}%</td>

                    <td className="px-4 py-2 text-xs">
                      {opp.nextStep ?? <span className="text-muted-foreground">-</span>}
                    </td>

                    <td className="px-4 py-2 text-xs">
                      {opp.lastActivityAt ? format(new Date(opp.lastActivityAt), "dd/MM/yyyy") : "-"}
                    </td>

                    <td className="px-2 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Acciones">
                            <LucideMoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingOpportunity(toOpportunityRow(opp))}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteOpportunity(opp.id, opp.name)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data?.total ? (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50 text-sm">
          <span>
            Página {page} de {Math.ceil(data.total / pageSize)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pageSize >= data.total}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}

      <OpportunityDrawer
        open={!!editingOpportunity}
        onClose={() => setEditingOpportunity(null)}
        companyId={companyId}
        opportunity={editingOpportunity}
      />
    </div>
  );
}
  