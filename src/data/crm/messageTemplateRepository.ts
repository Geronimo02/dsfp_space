import { supabase } from "@/integrations/supabase/client";
import type {
  MessageTemplateInsert,
  MessageTemplateUpdate,
} from "@/domain/crm/dtos/messageTemplate";
import { toMessageTemplateDTO } from "@/domain/crm/mappers/messageTemplateMapper";

export const messageTemplateRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from("crm_message_templates")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toMessageTemplateDTO);
  },

  async create(values: MessageTemplateInsert) {
    const { data, error } = await supabase
      .from("crm_message_templates")
      .insert([values])
      .select("*")
      .single();
    if (error) throw error;
    return toMessageTemplateDTO(data);
  },

  async update(id: string, values: MessageTemplateUpdate) {
    const { data, error } = await supabase
      .from("crm_message_templates")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toMessageTemplateDTO(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("crm_message_templates").delete().eq("id", id);
    if (error) throw error;
  },
};
