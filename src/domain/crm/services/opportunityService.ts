import type {
  OpportunityInsert,
  OpportunityUpdate,
  OpportunityListParams,
  OpportunityListResult,
} from "@/domain/crm/dtos/opportunity";
import { opportunityRepository } from "@/data/crm/opportunityRepository";
import { opportunitySchema } from "@/domain/crm/validation/opportunitySchema";
import { stageRuleService } from "@/domain/crm/services/stageRuleService";
import { crmNotificationService } from "@/domain/crm/services/crmNotificationService";

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
    const created = await opportunityRepository.create(values);
    await stageRuleService.applyForOpportunity({
      companyId: created.companyId,
      pipelineId: created.pipelineId,
      stage: created.stage,
      opportunityId: created.id,
    });
    return created;
  },

  async update(id: string, values: OpportunityUpdate) {
    const updated = await opportunityRepository.update(id, values);
    if (values.stage) {
      await crmNotificationService.notify({
        companyId: updated.companyId,
        type: "crm_stage_changed",
        title: "Oportunidad cambió de etapa",
        message: `La oportunidad "${updated.name}" ahora está en ${updated.stage}.`,
        data: { opportunity_id: updated.id, stage: updated.stage },
        userIds: updated.ownerId ? [updated.ownerId] : undefined,
      });
    }
    if (values.stage || values.pipeline_id) {
      await stageRuleService.applyForOpportunity({
        companyId: updated.companyId,
        pipelineId: updated.pipelineId,
        stage: updated.stage,
        opportunityId: updated.id,
      });
    }
    return updated;
  },

  async remove(id: string) {
    return opportunityRepository.remove(id);
  },
};
