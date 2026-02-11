import type { Database } from "@/integrations/supabase/types";

export type MessageLogRow = Database["public"]["Tables"]["crm_message_logs"]["Row"];
export type MessageLogInsert = Database["public"]["Tables"]["crm_message_logs"]["Insert"];
export type MessageLogUpdate = Database["public"]["Tables"]["crm_message_logs"]["Update"];

export interface MessageLogDTO {
  id: string;
  companyId: string;
  opportunityId: string | null;
  customerId: string | null;
  channel: "email" | "whatsapp";
  templateId: string | null;
  subject: string | null;
  body: string;
  recipient: string;
  status: "queued" | "sent" | "failed";
  providerMessageId: string | null;
  error: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface MessageLogListParams {
  companyId: string;
  opportunityId: string;
}
