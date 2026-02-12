import type { ScoringRuleDTO, ScoringRuleRow } from "@/domain/crm/dtos/scoringRule";

export const toScoringRuleDTO = (row: ScoringRuleRow): ScoringRuleDTO => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  field: row.field,
  operator: row.operator,
  value: row.value,
  points: row.points,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
