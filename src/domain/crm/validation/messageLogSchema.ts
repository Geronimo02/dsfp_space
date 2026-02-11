import { z } from "zod";

export const messageLogSchema = z.object({
  channel: z.enum(["email", "whatsapp"]),
  recipient: z.string().min(1, "El destinatario es requerido"),
  subject: z.string().optional(),
  body: z.string().min(1, "El contenido es requerido"),
});

export type MessageLogForm = z.infer<typeof messageLogSchema>;
