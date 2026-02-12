import { z } from "zod";

export const opportunitySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().min(1, "El email es requerido").email("Email inválido"),
  phone: z.string().min(1, "El teléfono es requerido"),
  customer_id: z.string().optional(),
  pipeline_id: z.string().optional(),
  stage: z.string().optional(),
  value: z.number().optional(),
  estimated_close_date: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  owner_id: z.string().optional(),
  status: z.string().optional(),
  close_date: z.string().optional(),
  lost_reason: z.string().optional(),
  won_reason: z.string().optional(),
  source: z.string().optional(),
  currency: z.string().optional(),
  expected_revenue: z.number().optional(),
  next_step: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type OpportunityForm = z.infer<typeof opportunitySchema>;
