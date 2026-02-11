import type { StageRuleDTO, StageRuleRow } from "@/domain/crm/dtos/stageRule";

export const toStageRuleDTO = (row: StageRuleRow): StageRuleDTO => ({
  id: row.id,
  companyId: row.company_id,
  pipelineId: row.pipeline_id,
  stage: row.stage,
  slaDays: row.sla_days,
  autoAssignOwnerId: row.auto_assign_owner_id,
  reminderDaysBefore: row.reminder_days_before,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
