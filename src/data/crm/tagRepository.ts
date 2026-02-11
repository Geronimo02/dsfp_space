import { supabase } from "@/integrations/supabase/client";
import type { TagInsert, TagUpdate } from "@/domain/crm/dtos/tag";
import { toTagDTO } from "@/domain/crm/mappers/tagMapper";

export const tagRepository = {
  async list(companyId: string) {
    const { data, error } = await supabase
      .from("crm_tags")
      .select("*")
      .eq("company_id", companyId)
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toTagDTO);
  },

  async create(values: TagInsert) {
    const { data, error } = await supabase
      .from("crm_tags")
      .insert([values])
      .select("*")
      .single();
    if (error) throw error;
    return toTagDTO(data);
  },

  async update(id: string, values: TagUpdate) {
    const { data, error } = await supabase
      .from("crm_tags")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toTagDTO(data);
  },

  async remove(id: string) {
    const { error } = await supabase.from("crm_tags").delete().eq("id", id);
    if (error) throw error;
  },
};
