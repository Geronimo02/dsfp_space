import { z } from "zod";

export const stageRuleSchema = z.object({
  stage: z.string().min(1, "La etapa es requerida"),
  sla_days: z.number().int().min(1).optional(),
  auto_assign_owner_id: z.string().uuid().optional(),
  reminder_days_before: z.number().int().min(0).optional(),
});

export type StageRuleForm = z.infer<typeof stageRuleSchema>;
