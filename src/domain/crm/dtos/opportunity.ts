import type { Database } from "@/integrations/supabase/types";

export type OpportunityRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];
export type OpportunityInsert = Database["public"]["Tables"]["crm_opportunities"]["Insert"];
export type OpportunityUpdate = Database["public"]["Tables"]["crm_opportunities"]["Update"];

export interface OpportunityDTO {
  id: string;
  companyId: string;
  name: string;
  customerId: string | null;
  pipelineId: string | null;
  stage: string;
  value: number | null;
  estimatedCloseDate: string | null;
  probability: number | null;
  description: string | null;
  ownerId: string | null;
  status: string | null;
  closeDate: string | null;
  lostReason: string | null;
  wonReason: string | null;
  source: string | null;
  currency: string | null;
  expectedRevenue: number | null;
  nextStep: string | null;
  lastActivityAt: string | null;
  tags: string[] | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OpportunityListParams {
  companyId: string;
  search?: string;
  filters?: {
    pipelineId?: string;
    stageId?: string;
    ownerId?: string;
    value?: { min: number; max: number };
  };
  sort?: { field: keyof OpportunityRow; direction: "asc" | "desc" };
  page?: number;
  pageSize?: number;
}

export interface OpportunityListResult {
  data: OpportunityDTO[];
  total: number;
}
