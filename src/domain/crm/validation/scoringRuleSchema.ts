import { z } from "zod";

export const scoringRuleSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  field: z.enum(["value", "probability", "stage", "status", "source", "tags"], {
    required_error: "El campo es requerido",
  }),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"], {
    required_error: "El operador es requerido",
  }),
  value: z.string().min(1, "El valor es requerido"),
  points: z.number().int(),
  active: z.boolean().optional(),
});

export type ScoringRuleForm = z.infer<typeof scoringRuleSchema>;
