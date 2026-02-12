import { supabase } from "@/integrations/supabase/client";
import type { ScoringRuleInsert, ScoringRuleUpdate } from "@/domain/crm/dtos/scoringRule";
import { toScoringRuleDTO } from "@/domain/crm/mappers/scoringRuleMapper";

export const scoringRuleRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from("crm_scoring_rules")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toScoringRuleDTO);
  },

  async listActive(companyId: string) {
    const { data, error } = await supabase
      .from("crm_scoring_rules")
      .select("*")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toScoringRuleDTO);
  },

  async create(values: ScoringRuleInsert) {
    const { data, error } = await supabase
      .from("crm_scoring_rules")
      .insert([values])
      .select("*")
      .single();
    if (error) throw error;
    return toScoringRuleDTO(data);
  },

  async update(id: string, values: ScoringRuleUpdate) {
    const { data, error } = await supabase
      .from("crm_scoring_rules")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toScoringRuleDTO(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("crm_scoring_rules").delete().eq("id", id);
    if (error) throw error;
  },
};
