import type {
  OpportunityInsert,
  OpportunityUpdate,
  OpportunityListParams,
  OpportunityListResult,
} from "@/domain/crm/dtos/opportunity";
import { opportunityRepository } from "@/data/crm/opportunityRepository";
import { opportunitySchema } from "@/domain/crm/validation/opportunitySchema";

export const opportunityService = {
  async list(params: OpportunityListParams): Promise<OpportunityListResult> {
    return opportunityRepository.list(params);
  },

  async getById(id: string) {
    return opportunityRepository.getById(id);
  },

  async create(values: OpportunityInsert) {
    opportunitySchema.parse({
      name: values.name,
      customer_id: values.customer_id || undefined,
      pipeline_id: values.pipeline_id || "",
      stage: values.stage || "",
      value: values.value ?? undefined,
      estimated_close_date: values.estimated_close_date || undefined,
      probability: values.probability ?? undefined,
      description: values.description || undefined,
      owner_id: values.owner_id || undefined,
      status: values.status || undefined,
      close_date: values.close_date || undefined,
      lost_reason: values.lost_reason || undefined,
      won_reason: values.won_reason || undefined,
      source: values.source || undefined,
      currency: values.currency || undefined,
      expected_revenue: values.expected_revenue ?? undefined,
      next_step: values.next_step || undefined,
      tags: values.tags || undefined,
    });
    return opportunityRepository.create(values);
  },

  async update(id: string, values: OpportunityUpdate) {
    return opportunityRepository.update(id, values);
  },

  async remove(id: string) {
    return opportunityRepository.remove(id);
  },
};
