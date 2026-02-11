import type { ActivityDTO, ActivityRow } from "@/domain/crm/dtos/activity";

export const toActivityDTO = (row: ActivityRow): ActivityDTO => ({
  id: row.id,
  companyId: row.company_id,
  opportunityId: row.opportunity_id,
  type: row.type,
  subject: row.subject ?? null,
  notes: row.notes ?? null,
  dueAt: row.due_at ?? null,
  completedAt: row.completed_at ?? null,
  createdBy: row.created_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
