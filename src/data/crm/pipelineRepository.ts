import { supabase } from "@/integrations/supabase/client";
import type { PipelineInsert, PipelineUpdate } from "@/domain/crm/dtos/pipeline";
import { toPipelineDTO } from "@/domain/crm/mappers/pipelineMapper";

export const pipelineRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from("crm_pipelines")
      .select("id, company_id, name, stages, created_at, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toPipelineDTO);
  },

  async create(values: PipelineInsert) {
    const { data, error } = await supabase
      .from("crm_pipelines")
      .insert([values])
      .select("*")
      .single();
    if (error) throw error;
    return toPipelineDTO(data);
  },

  async update(id: string, values: PipelineUpdate) {
    const { data, error } = await supabase
      .from("crm_pipelines")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toPipelineDTO(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("crm_pipelines").delete().eq("id", id);
    if (error) throw error;
  },
};
