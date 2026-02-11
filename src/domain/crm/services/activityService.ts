import type {
  ActivityInsert,
  ActivityUpdate,
  ActivityListParams,
  ActivityListResult,
} from "@/domain/crm/dtos/activity";
import { activityRepository } from "@/data/crm/activityRepository";
import { activitySchema } from "../validation/activitySchema";

export const activityService = {
  async listByOpportunity(params: ActivityListParams): Promise<ActivityListResult> {
    return activityRepository.listByOpportunity(params);
  },

  async create(values: ActivityInsert) {
    activitySchema.parse({
      type: values.type,
      subject: values.subject ?? undefined,
      notes: values.notes ?? undefined,
      due_at: values.due_at ?? undefined,
      completed_at: values.completed_at ?? undefined,
    });
    return activityRepository.create(values);
  },

  async update(id: string, values: ActivityUpdate) {
    return activityRepository.update(id, values);
  },

  async remove(id: string) {
    return activityRepository.remove(id);
  },
};
