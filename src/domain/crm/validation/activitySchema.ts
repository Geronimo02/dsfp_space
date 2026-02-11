import { z } from "zod";

export const activitySchema = z.object({
  type: z.enum(["call", "email", "task", "meeting", "note"], {
    required_error: "El tipo es requerido",
  }),
  subject: z.string().optional(),
  notes: z.string().optional(),
  due_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type ActivityForm = z.infer<typeof activitySchema>;
