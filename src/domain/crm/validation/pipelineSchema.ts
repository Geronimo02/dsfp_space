import { z } from "zod";

export const pipelineSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  stages: z.array(z.string().min(1)).min(1, "Debe tener al menos una etapa"),
});

export type PipelineForm = z.infer<typeof pipelineSchema>;
