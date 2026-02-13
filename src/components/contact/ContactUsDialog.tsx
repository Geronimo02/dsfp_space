import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Send, CheckCircle2, CalendarClock, Phone, Mail, Building2, User } from "lucide-react";
import type { BotRequestFormData } from "@/types/botRequests";

interface ContactUsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill from authenticated user context */
  defaultValues?: Partial<BotRequestFormData>;
}

export function ContactUsDialog({ open, onOpenChange, defaultValues }: ContactUsDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [form, setForm] = useState<BotRequestFormData>({
    contact_name: defaultValues?.contact_name ?? "",
    contact_email: defaultValues?.contact_email ?? "",
    contact_phone: defaultValues?.contact_phone ?? "",
    company_name: defaultValues?.company_name ?? "",
    subject: defaultValues?.subject ?? "",
    description: defaultValues?.description ?? "",
    bot_objectives: defaultValues?.bot_objectives ?? "",
    preferred_schedule: defaultValues?.preferred_schedule ?? "",
  });

  const updateField = (field: keyof BotRequestFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.contact_name || !form.contact_email || !form.subject || !form.description) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get current user if authenticated
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("bot_implementation_requests" as any)
        .insert({
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone || null,
          company_name: form.company_name || null,
          subject: form.subject,
          description: form.description,
          bot_objectives: form.bot_objectives || null,
          preferred_schedule: form.preferred_schedule || null,
          status: "solicitud",
          created_by: user?.id || null,
        } as any);

      if (error) throw error;

      setIsSubmitted(true);
      toast.success("¡Solicitud enviada con éxito!");
    } catch (error: any) {
      console.error("Error submitting bot request:", error);
      toast.error("Error al enviar la solicitud. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after dialog animation completes
    setTimeout(() => {
      setIsSubmitted(false);
      setForm({
        contact_name: defaultValues?.contact_name ?? "",
        contact_email: defaultValues?.contact_email ?? "",
        contact_phone: defaultValues?.contact_phone ?? "",
        company_name: defaultValues?.company_name ?? "",
        subject: "",
        description: "",
        bot_objectives: "",
        preferred_schedule: "",
      });
    }, 300);
  };

  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold">¡Solicitud Recibida!</h3>
            <p className="text-muted-foreground max-w-sm">
              Hemos recibido tu solicitud para la implementación de un bot personalizado.
              Nuestro equipo se pondrá en contacto contigo para agendar una llamada de diagnóstico.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 w-full max-w-sm text-sm space-y-2">
              <h4 className="font-medium">Próximos pasos:</h4>
              <div className="flex items-start gap-2">
                <CalendarClock className="w-4 h-4 mt-0.5 text-primary" />
                <span>Te contactaremos en 24-48 horas hábiles</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 text-primary" />
                <span>Realizaremos una llamada de diagnóstico</span>
              </div>
              <div className="flex items-start gap-2">
                <Send className="w-4 h-4 mt-0.5 text-primary" />
                <span>Te enviaremos un presupuesto formal</span>
              </div>
            </div>
            <Button onClick={handleClose} className="mt-2">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg">Solicitar Bot Personalizado</DialogTitle>
              <DialogDescription>
                Completa el formulario y nuestro equipo te contactará para crear tu bot a medida
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Contact Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Información de contacto
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact_name" className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Nombre completo *
                </Label>
                <Input
                  id="contact_name"
                  value={form.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  placeholder="Tu nombre"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_email" className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email *
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => updateField("contact_email", e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Teléfono
                </Label>
                <Input
                  id="contact_phone"
                  value={form.contact_phone}
                  onChange={(e) => updateField("contact_phone", e.target.value)}
                  placeholder="+54 11 1234-5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company_name" className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Empresa
                </Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  placeholder="Nombre de tu empresa"
                />
              </div>
            </div>
          </div>

          {/* Bot Requirements */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Detalles del bot
            </h4>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="subject">Asunto / Tipo de bot *</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                  placeholder="Ej: Bot de atención al cliente, Bot de ventas, Automatización..."
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Descripción del requerimiento *</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe qué necesitas que haga el bot, en qué contexto se usará, y cualquier detalle relevante..."
                  className="min-h-[100px]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bot_objectives">Objetivos del bot</Label>
                <Textarea
                  id="bot_objectives"
                  value={form.bot_objectives}
                  onChange={(e) => updateField("bot_objectives", e.target.value)}
                  placeholder="¿Qué resultados esperas lograr? Ej: reducir tiempos de respuesta, automatizar consultas frecuentes..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preferred_schedule">Disponibilidad para llamada de diagnóstico</Label>
                <Select
                  value={form.preferred_schedule}
                  onValueChange={(value) => updateField("preferred_schedule", value)}
                >
                  <SelectTrigger id="preferred_schedule">
                    <SelectValue placeholder="Selecciona tu disponibilidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manana">Mañanas (9:00 - 12:00)</SelectItem>
                    <SelectItem value="mediodia">Mediodía (12:00 - 14:00)</SelectItem>
                    <SelectItem value="tarde">Tardes (14:00 - 18:00)</SelectItem>
                    <SelectItem value="flexible">Horario flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
            <p className="text-blue-800 dark:text-blue-200">
              <strong>¿Cómo funciona?</strong> Tras enviar tu solicitud, nuestro equipo realizará
              una llamada de diagnóstico para entender tus necesidades. Luego recibirás un
              presupuesto formal con alcance, tiempo estimado y precio.
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Solicitud
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
