import type { Database, Json } from "@/integrations/supabase/types";

export type ActivityLogRow = Database["public"]["Tables"]["crm_activity_log"]["Row"];
export type ActivityLogInsert = Database["public"]["Tables"]["crm_activity_log"]["Insert"];
export type ActivityLogUpdate = Database["public"]["Tables"]["crm_activity_log"]["Update"];

export interface ActivityLogDTO {
  id: string;
  companyId: string;
  opportunityId: string | null;
  activityId: string | null;
  action: string;
  payload: Json | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ActivityLogListParams {
  companyId: string;
  opportunityId?: string;
  activityId?: string;
  page?: number;
  pageSize?: number;
}

export interface ActivityLogListResult {
  data: ActivityLogDTO[];
  total: number;
}
