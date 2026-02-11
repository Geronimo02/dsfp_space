import { supabase } from "@/integrations/supabase/client";
import type {
  ActivityInsert,
  ActivityUpdate,
  ActivityListParams,
  ActivityListResult,
} from "@/domain/crm/dtos/activity";
import { toActivityDTO } from "@/domain/crm/mappers/activityMapper";

export const activityRepository = {
  async listByOpportunity(params: ActivityListParams): Promise<ActivityListResult> {
    let q = supabase
      .from("crm_activities")
      .select("*")
      .eq("company_id", params.companyId);

    if (params.opportunityId) q = q.eq("opportunity_id", params.opportunityId);
    if (params.type) q = q.eq("type", params.type);

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    q = q.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data ?? [];
    return { data: rows.map(toActivityDTO), total: rows.length };
  },

  async create(values: ActivityInsert) {
    const { data, error } = await supabase
      .from("crm_activities")
      .insert([values])
      .select("*")
      .single();
    if (error) throw error;
    return toActivityDTO(data);
  },

  async update(id: string, values: ActivityUpdate) {
    const { data, error } = await supabase
      .from("crm_activities")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toActivityDTO(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("crm_activities").delete().eq("id", id);
    if (error) throw error;
  },
};
