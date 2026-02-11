import { z } from "zod";

export const tagSchema = z.object({
  name: z.string().min(1, "El nombre del tag es requerido"),
  color: z.string().min(1, "El color es requerido"),
});

export type TagForm = z.infer<typeof tagSchema>;
