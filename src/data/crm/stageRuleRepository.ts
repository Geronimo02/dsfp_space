import { supabase } from "@/integrations/supabase/client";
import type { StageRuleListParams, StageRuleUpsert } from "@/domain/crm/dtos/stageRule";
import { toStageRuleDTO } from "@/domain/crm/mappers/stageRuleMapper";

export const stageRuleRepository = {
  async listByPipeline(params: StageRuleListParams) {
    const { data, error } = await supabase
      .from("crm_stage_rules")
      .select("*")
      .eq("company_id", params.companyId)
      .eq("pipeline_id", params.pipelineId)
      .order("stage", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toStageRuleDTO);
  },

  async getByPipelineStage(companyId: string, pipelineId: string, stage: string) {
    const { data, error } = await supabase
      .from("crm_stage_rules")
      .select("*")
      .eq("company_id", companyId)
      .eq("pipeline_id", pipelineId)
      .eq("stage", stage)
      .maybeSingle();
    if (error) throw error;
    return data ? toStageRuleDTO(data) : null;
  },

  async upsert(values: StageRuleUpsert) {
    const { data, error } = await supabase
      .from("crm_stage_rules")
      .upsert(values, { onConflict: "company_id,pipeline_id,stage" })
      .select("*")
      .single();
    if (error) throw error;
    return toStageRuleDTO(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("crm_stage_rules").delete().eq("id", id);
    if (error) throw error;
  },
};
