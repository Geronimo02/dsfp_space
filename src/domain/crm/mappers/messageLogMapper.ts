import type { MessageLogDTO, MessageLogRow } from "@/domain/crm/dtos/messageLog";

export const toMessageLogDTO = (row: MessageLogRow): MessageLogDTO => ({
  id: row.id,
  companyId: row.company_id,
  opportunityId: row.opportunity_id,
  customerId: row.customer_id,
  channel: row.channel as "email" | "whatsapp",
  templateId: row.template_id,
  subject: row.subject,
  body: row.body,
  recipient: row.recipient,
  status: row.status as "queued" | "sent" | "failed",
  providerMessageId: row.provider_message_id,
  error: row.error,
  createdBy: row.created_by,
  createdAt: row.created_at,
});
