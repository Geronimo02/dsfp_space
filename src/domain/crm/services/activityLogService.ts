import type {
  ActivityLogInsert,
  ActivityLogUpdate,
  ActivityLogListParams,
  ActivityLogListResult,
} from "@/domain/crm/dtos/activityLog";
import { activityLogRepository } from "@/data/crm/activityLogRepository";
import { activityLogSchema } from "../validation/activityLogSchema";

export const activityLogService = {
  async listByOpportunity(params: ActivityLogListParams): Promise<ActivityLogListResult> {
    return activityLogRepository.listByOpportunity(params);
  },

  async create(values: ActivityLogInsert) {
    activityLogSchema.parse({
      action: values.action,
      payload: values.payload ?? undefined,
    });
    return activityLogRepository.create(values);
  },

  async update(id: string, values: ActivityLogUpdate) {
    return activityLogRepository.update(id, values);
  },

  async remove(id: string) {
    return activityLogRepository.remove(id);
  },
};
