import type { TagDTO, TagRow } from "@/domain/crm/dtos/tag";

export const toTagDTO = (row: TagRow): TagDTO => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  color: row.color,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
