import { supabase } from "@/integrations/supabase/client";
import type { MessageLogInsert, MessageLogUpdate, MessageLogListParams } from "@/domain/crm/dtos/messageLog";
import { messageLogRepository } from "@/data/crm/messageLogRepository";
import { messageLogSchema } from "@/domain/crm/validation/messageLogSchema";

export const messageLogService = {
  async listByOpportunity(params: MessageLogListParams) {
    return messageLogRepository.listByOpportunity(params.companyId, params.opportunityId);
  },

  async create(values: MessageLogInsert) {
    messageLogSchema.parse({
      channel: values.channel as "email" | "whatsapp",
      recipient: values.recipient,
      subject: values.subject ?? undefined,
      body: values.body,
    });
    return messageLogRepository.create(values);
  },

  async update(id: string, values: MessageLogUpdate) {
    return messageLogRepository.update(id, values);
  },

  async sendMessage(params: {
    logId: string;
    channel: "email" | "whatsapp";
    recipient: string;
    subject?: string | null;
    body: string;
  }) {
    const { error } = await supabase.functions.invoke("send-crm-message", {
      body: {
        log_id: params.logId,
        channel: params.channel,
        recipient: params.recipient,
        subject: params.subject ?? null,
        body: params.body,
      },
    });
    if (error) throw error;
  },
};
