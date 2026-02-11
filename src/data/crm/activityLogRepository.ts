import { supabase } from "@/integrations/supabase/client";
import type {
  ActivityLogInsert,
  ActivityLogUpdate,
  ActivityLogListParams,
  ActivityLogListResult,
} from "@/domain/crm/dtos/activityLog";
import { toActivityLogDTO } from "@/domain/crm/mappers/activityLogMapper";

export const activityLogRepository = {
  async listByOpportunity(params: ActivityLogListParams): Promise<ActivityLogListResult> {
    let q = supabase
      .from("crm_activity_log")
      .select("*")
      .eq("company_id", params.companyId);

    if (params.opportunityId) q = q.eq("opportunity_id", params.opportunityId);
    if (params.activityId) q = q.eq("activity_id", params.activityId);

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    q = q.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data ?? [];
    return { data: rows.map(toActivityLogDTO), total: rows.length };
  },

  async create(values: ActivityLogInsert) {
    const { data, error } = await supabase
      .from("crm_activity_log")
      .insert([values])
      .select("*")
      .single();
    if (error) throw error;
    return toActivityLogDTO(data);
  },

  async update(id: string, values: ActivityLogUpdate) {
    const { data, error } = await supabase
      .from("crm_activity_log")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toActivityLogDTO(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("crm_activity_log").delete().eq("id", id);
    if (error) throw error;
  },
};
