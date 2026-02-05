import type { Database } from "@/integrations/supabase/types";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LucideMoreVertical } from "lucide-react";
import { format } from "date-fns";

// --- Types ---
type OpportunityBaseRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];

// Extend row with the fields you are selecting via joins/aliases.
// NOTE: If `stage` is a relation (object), change this accordingly.
type OpportunityRow = OpportunityBaseRow & {
  customers?: { name: string } | null;
  owner?: { name: string } | null; // you render this, so include it
  next_step?: string | null;
  last_activity_at?: string | null;
};

interface OpportunitiesListProps {
  companyId: string;
  search: string;
  filters: {
    pipelineId?: string;
    stageId?: string;
    ownerId?: string;
    value?: { min: number; max: number };
  };
  onCreate?: () => void;
}

type OpportunitiesQueryResult = {
  data: OpportunityRow[];
  total: number;
};

// Only allow sorting by real columns (and optionally custom ones)
type SortableField = keyof OpportunityBaseRow;

export function OpportunitiesList({
  companyId,
  search,
  filters,
  onCreate,
}: OpportunitiesListProps) {
  // --- Pagination & Sorting ---
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [sort, setSort] = useState<{ field: SortableField; direction: "asc" | "desc" }>(
    { field: "close_date", direction: "desc" } as any
  );

  // --- Stable query key (NO complex object) ---
  const queryKey = useMemo(
    () =>
      [
        "opportunities",
        companyId,
        search ?? "",
        filters.pipelineId ?? "",
        filters.stageId ?? "",
        filters.ownerId ?? "",
        filters.value?.min ?? "",
        filters.value?.max ?? "",
        sort.field,
        sort.direction,
        page,
        pageSize,
      ] as const,
    [
      companyId,
      search,
      filters.pipelineId,
      filters.stageId,
      filters.ownerId,
      filters.value?.min,
      filters.value?.max,
      sort.field,
      sort.direction,
      page,
      pageSize,
    ]
  );

  // --- Data fetching ---
  const { data, isLoading, isError, refetch, isFetching } = useQuery<
    OpportunitiesQueryResult,
    Error
  >({
    queryKey,
    queryFn: async (): Promise<OpportunitiesQueryResult> => {
      let q = supabase
        .from("crm_opportunities")
        .select("*, customers(name), owner:employees(name), stage")
        .eq("company_id", companyId);


      if (search) q = q.ilike("name",`%${search}%`);
      if (filters.pipelineId) q = q.eq("pipeline_id", filters.pipelineId);
      if (filters.stageId) q = q.eq("stage", filters.stageId);
      if (filters.ownerId) q = q.eq("owner_id", filters.ownerId);


      if (filters.value) {
        q = q.gte("value", filters.value.min).lte("value", filters.value.max);
      }

      // supabase expects a real column name
      if (sort.field) {
        q = q.order(sort.field as string, { ascending: sort.direction === "asc" });
      }

      q = q.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error } = await q;
      if (error) throw error;

      const typedData = (data ?? []) as unknown as OpportunityRow[];
      return { data: typedData, total: typedData.length };
    },

    enabled: !!companyId,

    // TanStack Query v4:
    placeholderData: (prev) => prev,
  });

  // --- Table columns ---
  const columns: { key: keyof OpportunityRow | "actions"; label: string }[] = [
    { key: "name", label: "Oportunidad" },
    { key: "stage", label: "Etapa" },
    { key: "value", label: "Monto" },
    { key: "estimated_close_date", label: "Cierre" },
    { key: "probability", label: "%" },
    { key: "next_step", label: "Próximo paso" },
    { key: "owner", label: "Responsable" },
    { key: "last_activity_at", label: "Última actividad" },
    { key: "actions", label: "" },
  ];

  const handleSort = (key: keyof OpportunityRow | "actions") => {
    if (key === "actions") return;

    // only allow sorting by real DB columns
    if (!Object.prototype.hasOwnProperty.call(({} as OpportunityBaseRow), key)) {
      // For joined/computed fields like owner/customers/stage strings, ignore sorting to avoid runtime issues
      return;
    }

    setSort((s) => ({
      field: key as SortableField,
      direction: s.field === key && s.direction === "desc" ? "asc" : "desc",
    }));
    setPage(1);
  };

  return (
    <div className="bg-white rounded-lg shadow p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-gray-100">
            <tr>
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

          <tbody>
            {isLoading || isFetching ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data?.data?.length ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12">
                  <div className="text-muted-foreground mb-2">Aún no hay oportunidades.</div>
                  <Button onClick={onCreate}>Crear oportunidad</Button>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8">
                  <div className="text-red-500 mb-2">Error al cargar oportunidades.</div>
                  <Button variant="outline" onClick={() => refetch()}>
                    Reintentar
                  </Button>
                </td>
              </tr>
            ) : (
              data.data.map((opp) => (
                <tr key={opp.id} className="border-b hover:bg-gray-50 group">
                  <td className="px-4 py-2 font-semibold max-w-xs truncate">{opp.name}</td>

                  <td className="px-4 py-2">
                    {opp.stage ? <Badge variant="secondary">{opp.stage}</Badge> : <Badge variant="secondary">-</Badge>}
                  </td>

                  <td className="px-4 py-2 font-mono">{opp.value ? `$${opp.value}` : "-"}</td>

                  <td className="px-4 py-2">
                    {opp.estimated_close_date ? format(new Date(opp.estimated_close_date), "dd/MM/yyyy") : "-"}
                  </td>

                  <td className="px-4 py-2">{opp.probability ?? "-"}%</td>

                  <td className="px-4 py-2 text-xs">
                    {opp.next_step ?? <span className="text-muted-foreground">-</span>}
                  </td>

                  <td className="px-4 py-2">
                    {opp.owner?.name ?? <span className="text-muted-foreground">-</span>}
                  </td>

                  <td className="px-4 py-2 text-xs">
                    {opp.last_activity_at ? format(new Date(opp.last_activity_at), "dd/MM/yyyy") : "-"}
                  </td>

                  <td className="px-2 py-2">
                    <Button variant="ghost" size="icon" aria-label="Acciones">
                      <LucideMoreVertical className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
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
    </div>
  );
}
  