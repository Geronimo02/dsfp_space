import type { Database } from "@/integrations/supabase/types";

export type ActivityRow = Database["public"]["Tables"]["crm_activities"]["Row"];
export type ActivityInsert = Database["public"]["Tables"]["crm_activities"]["Insert"];
export type ActivityUpdate = Database["public"]["Tables"]["crm_activities"]["Update"];

export interface ActivityDTO {
  id: string;
  companyId: string;
  opportunityId: string | null;
  type: string;
  subject: string | null;
  notes: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityListParams {
  companyId: string;
  opportunityId?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export interface ActivityListResult {
  data: ActivityDTO[];
  total: number;
}
