import type { PipelineDTO, PipelineRow } from "@/domain/crm/dtos/pipeline";

export const toPipelineDTO = (row: PipelineRow): PipelineDTO => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  stages: row.stages,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
