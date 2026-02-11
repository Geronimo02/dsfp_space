import type { Database } from "@/integrations/supabase/types";

export type StageRuleRow = Database["public"]["Tables"]["crm_stage_rules"]["Row"];
export type StageRuleInsert = Database["public"]["Tables"]["crm_stage_rules"]["Insert"];
export type StageRuleUpdate = Database["public"]["Tables"]["crm_stage_rules"]["Update"];

export interface StageRuleDTO {
  id: string;
  companyId: string;
  pipelineId: string;
  stage: string;
  slaDays: number | null;
  autoAssignOwnerId: string | null;
  reminderDaysBefore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface StageRuleListParams {
  companyId: string;
  pipelineId: string;
}

export interface StageRuleUpsert {
  company_id: string;
  pipeline_id: string;
  stage: string;
  sla_days?: number | null;
  auto_assign_owner_id?: string | null;
  reminder_days_before?: number | null;
}
