import { z } from "zod";

export const activityLogSchema = z.object({
  action: z.string().min(1, "La acción es requerida"),
  payload: z.record(z.any()).optional(),
});

export type ActivityLogForm = z.infer<typeof activityLogSchema>;
