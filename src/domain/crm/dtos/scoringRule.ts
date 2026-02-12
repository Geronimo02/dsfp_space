import type { Database } from "@/integrations/supabase/types";

export type ScoringRuleRow = Database["public"]["Tables"]["crm_scoring_rules"]["Row"];
export type ScoringRuleInsert = Database["public"]["Tables"]["crm_scoring_rules"]["Insert"];
export type ScoringRuleUpdate = Database["public"]["Tables"]["crm_scoring_rules"]["Update"];

export interface ScoringRuleDTO {
  id: string;
  companyId: string;
  name: string;
  field: string;
  operator: string;
  value: string;
  points: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
