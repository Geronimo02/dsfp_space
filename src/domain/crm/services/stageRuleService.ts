import { addDays } from "date-fns";
import type { StageRuleListParams, StageRuleUpsert } from "@/domain/crm/dtos/stageRule";
import { stageRuleRepository } from "@/data/crm/stageRuleRepository";
import { stageRuleSchema } from "@/domain/crm/validation/stageRuleSchema";
import { opportunityRepository } from "@/data/crm/opportunityRepository";
import { activityService } from "@/domain/crm/services/activityService";
import { crmNotificationService } from "@/domain/crm/services/crmNotificationService";

export const stageRuleService = {
  async listByPipeline(params: StageRuleListParams) {
    return stageRuleRepository.listByPipeline(params);
  },

  async upsert(values: StageRuleUpsert) {
    stageRuleSchema.parse({
      stage: values.stage,
      sla_days: values.sla_days ?? undefined,
      auto_assign_owner_id: values.auto_assign_owner_id ?? undefined,
      reminder_days_before: values.reminder_days_before ?? undefined,
    });
    return stageRuleRepository.upsert(values);
  },

  async remove(id: string) {
    return stageRuleRepository.remove(id);
  },

  async applyForOpportunity(params: {
    companyId: string;
    pipelineId: string | null;
    stage: string | null;
    opportunityId: string;
  }) {
    if (!params.pipelineId || !params.stage) return;

    const rule = await stageRuleRepository.getByPipelineStage(
      params.companyId,
      params.pipelineId,
      params.stage
    );
    if (!rule) return;

    const updates: Record<string, any> = {};
    if (rule.autoAssignOwnerId) {
      updates.owner_id = rule.autoAssignOwnerId;
    }

    if (typeof rule.slaDays === "number" && rule.slaDays > 0) {
      updates.sla_due_at = addDays(new Date(), rule.slaDays).toISOString();
    }

    if (Object.keys(updates).length) {
      updates.updated_at = new Date().toISOString();
      await opportunityRepository.update(params.opportunityId, updates);
    }

    const opportunity = await opportunityRepository.getById(params.opportunityId);

    if (rule.autoAssignOwnerId) {
      await crmNotificationService.notify({
        companyId: params.companyId,
        type: "crm_auto_assign",
        title: "Asignación automática en CRM",
        message: `Se te asignó la oportunidad "${opportunity.name}" en la etapa ${opportunity.stage}.`,
        data: { opportunity_id: opportunity.id, stage: opportunity.stage },
        userIds: [rule.autoAssignOwnerId],
      });
    }

    if (typeof rule.slaDays === "number" && rule.slaDays > 0) {
      await crmNotificationService.notify({
        companyId: params.companyId,
        type: "crm_sla_assigned",
        title: "SLA asignado a oportunidad",
        message: `Se asignó un SLA de ${rule.slaDays} días a la oportunidad "${opportunity.name}".`,
        data: { opportunity_id: opportunity.id, stage: opportunity.stage },
        userIds: opportunity.ownerId ? [opportunity.ownerId] : undefined,
      });
    }

    if (typeof rule.reminderDaysBefore === "number") {
      const reminderBase = typeof rule.slaDays === "number" && rule.slaDays > 0
        ? addDays(new Date(), Math.max(rule.slaDays - rule.reminderDaysBefore, 0))
        : addDays(new Date(), rule.reminderDaysBefore);

      await activityService.create({
        company_id: params.companyId,
        opportunity_id: params.opportunityId,
        type: "task",
        subject: `Recordatorio SLA: ${params.stage}`,
        notes: "Generado automáticamente por regla de etapa",
        due_at: reminderBase.toISOString(),
      });

      await crmNotificationService.notify({
        companyId: params.companyId,
        type: "crm_reminder_created",
        title: "Recordatorio CRM creado",
        message: `Se creó un recordatorio para la oportunidad "${opportunity.name}".`,
        data: { opportunity_id: opportunity.id, stage: opportunity.stage },
        userIds: opportunity.ownerId ? [opportunity.ownerId] : undefined,
      });
    }
  },
};
