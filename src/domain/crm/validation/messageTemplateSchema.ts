import { z } from "zod";

export const messageTemplateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  channel: z.enum(["email", "whatsapp"]),
  subject: z.string().optional(),
  body: z.string().min(1, "El contenido es requerido"),
});

export type MessageTemplateForm = z.infer<typeof messageTemplateSchema>;
