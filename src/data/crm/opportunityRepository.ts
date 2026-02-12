import { supabase } from "@/integrations/supabase/client";
import type {
  OpportunityInsert,
  OpportunityUpdate,
  OpportunityListParams,
  OpportunityListResult,
} from "@/domain/crm/dtos/opportunity";
import { toOpportunityDTO } from "@/domain/crm/mappers/opportunityMapper";

export const opportunityRepository = {
  async list(params: OpportunityListParams): Promise<OpportunityListResult> {
    let q = supabase
      .from("crm_opportunities")
      .select(
        "id, company_id, name, customer_id, pipeline_id, stage, value, estimated_close_date, probability, next_step, last_activity_at, sla_due_at, score_total, score_updated_at, created_at, updated_at, owner_id, status",
        { count: "estimated" }
      )
      .eq("company_id", params.companyId);

    if (params.search) q = q.ilike("name", `%${params.search}%`);
    if (params.filters?.pipelineId) q = q.eq("pipeline_id", params.filters.pipelineId);
    if (params.filters?.stageId) q = q.eq("stage", params.filters.stageId);
    if (params.filters?.ownerId) q = q.eq("owner_id", params.filters.ownerId);
    if (params.filters?.status) q = q.eq("status", params.filters.status);
    if (params.filters?.dateRange) {
      q = q
        .gte("estimated_close_date", params.filters.dateRange.from)
        .lte("estimated_close_date", params.filters.dateRange.to);
    }
    if (params.filters?.value) {
      q = q.gte("value", params.filters.value.min).lte("value", params.filters.value.max);
    }
    if (params.sort?.field) {
      q = q.order(params.sort.field as string, { ascending: params.sort.direction === "asc" });
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    q = q.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await q;
    if (error) throw error;

    const rows = data ?? [];
    return { data: rows.map(toOpportunityDTO), total: count ?? rows.length };
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return toOpportunityDTO(data);
  },

  async create(values: OpportunityInsert) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .insert([values])
      .select("*")
      .single();
    if (error) throw error;
    return toOpportunityDTO(data);
  },

  async update(id: string, values: OpportunityUpdate) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toOpportunityDTO(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("crm_opportunities").delete().eq("id", id);
    if (error) throw error;
  },

  async listForScoring(companyId: string) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw error;
    return (data ?? []).map(toOpportunityDTO);
  },
};
