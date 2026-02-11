import type { MessageTemplateDTO, MessageTemplateRow } from "@/domain/crm/dtos/messageTemplate";

export const toMessageTemplateDTO = (row: MessageTemplateRow): MessageTemplateDTO => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  channel: row.channel as "email" | "whatsapp",
  subject: row.subject,
  body: row.body,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
