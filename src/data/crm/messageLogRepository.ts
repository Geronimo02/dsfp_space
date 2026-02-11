import { supabase } from "@/integrations/supabase/client";
import type { MessageLogInsert, MessageLogUpdate } from "@/domain/crm/dtos/messageLog";
import { toMessageLogDTO } from "@/domain/crm/mappers/messageLogMapper";

export const messageLogRepository = {
  async listByOpportunity(companyId: string, opportunityId: string) {
    const { data, error } = await supabase
      .from("crm_message_logs")
      .select("*")
      .eq("company_id", companyId)
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toMessageLogDTO);
  },

  async create(values: MessageLogInsert) {
    const { data, error } = await supabase
      .from("crm_message_logs")
      .insert([values])
      .select("*")
      .single();
    if (error) throw error;
    return toMessageLogDTO(data);
  },

  async update(id: string, values: MessageLogUpdate) {
    const { data, error } = await supabase
      .from("crm_message_logs")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toMessageLogDTO(data);
  },
};
