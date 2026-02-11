import type { Database } from "@/integrations/supabase/types";

export type MessageTemplateRow = Database["public"]["Tables"]["crm_message_templates"]["Row"];
export type MessageTemplateInsert = Database["public"]["Tables"]["crm_message_templates"]["Insert"];
export type MessageTemplateUpdate = Database["public"]["Tables"]["crm_message_templates"]["Update"];

export interface MessageTemplateDTO {
  id: string;
  companyId: string;
  name: string;
  channel: "email" | "whatsapp";
  subject: string | null;
  body: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
