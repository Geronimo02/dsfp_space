import type { ActivityLogDTO, ActivityLogRow } from "@/domain/crm/dtos/activityLog";

export const toActivityLogDTO = (row: ActivityLogRow): ActivityLogDTO => ({
  id: row.id,
  companyId: row.company_id,
  opportunityId: row.opportunity_id ?? null,
  activityId: row.activity_id ?? null,
  action: row.action,
  payload: row.payload ?? null,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
});
