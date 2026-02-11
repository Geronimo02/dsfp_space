import type { Database } from "@/integrations/supabase/types";

export type PipelineRow = Database["public"]["Tables"]["crm_pipelines"]["Row"];
export type PipelineInsert = Database["public"]["Tables"]["crm_pipelines"]["Insert"];
export type PipelineUpdate = Database["public"]["Tables"]["crm_pipelines"]["Update"];

export interface PipelineDTO {
  id: string;
  companyId: string;
  name: string;
  stages: string[];
  createdAt: string | null;
  updatedAt: string | null;
}
