import type { Database } from "@/integrations/supabase/types";

export type TagRow = Database["public"]["Tables"]["crm_tags"]["Row"];
export type TagInsert = Database["public"]["Tables"]["crm_tags"]["Insert"];
export type TagUpdate = Database["public"]["Tables"]["crm_tags"]["Update"];

export interface TagDTO {
  id: string;
  companyId: string;
  name: string;
  color: string;
  createdAt: string | null;
  updatedAt: string | null;
}
