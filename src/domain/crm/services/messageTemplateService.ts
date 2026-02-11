import type { MessageTemplateInsert, MessageTemplateUpdate } from "@/domain/crm/dtos/messageTemplate";
import { messageTemplateRepository } from "@/data/crm/messageTemplateRepository";
import { messageTemplateSchema } from "@/domain/crm/validation/messageTemplateSchema";

export const messageTemplateService = {
  async list(companyId: string) {
    return messageTemplateRepository.list(companyId);
  },

  async create(values: MessageTemplateInsert) {
    messageTemplateSchema.parse({
      name: values.name,
      channel: values.channel as "email" | "whatsapp",
      subject: values.subject ?? undefined,
      body: values.body,
    });
    return messageTemplateRepository.create(values);
  },

  async update(id: string, values: MessageTemplateUpdate) {
    return messageTemplateRepository.update(id, values);
  },

  async remove(id: string) {
    return messageTemplateRepository.remove(id);
  },
};
