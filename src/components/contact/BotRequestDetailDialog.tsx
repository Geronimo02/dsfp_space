import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  User, Mail, Phone, Building2, CalendarClock, Bot,
  FileText, DollarSign, Code2, CheckCircle2, Rocket,
  Clock, ArrowRight, AlertCircle,
} from "lucide-react";
import { BotRequestStatusBadge } from "./BotRequestStatusBadge";
import type { BotImplementationRequest, BotRequestStatus, BotRequestActivityLog } from "@/types/botRequests";
import { BOT_REQUEST_STAGES } from "@/types/botRequests";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

interface BotRequestDetailDialogProps {
  request: BotImplementationRequest | null;
  activityLog: BotRequestActivityLog[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  isAdmin: boolean;
}

// Define the valid pipeline transitions
const VALID_TRANSITIONS: Record<BotRequestStatus, BotRequestStatus[]> = {
  solicitud: ["diagnostico", "cancelado"],
  diagnostico: ["presupuesto_enviado", "cancelado"],
  presupuesto_enviado: ["aprobado", "no_aprobado", "cancelado"],
  aprobado: ["en_desarrollo", "cancelado"],
  en_desarrollo: ["implementado", "presupuesto_enviado", "cancelado"], // Can go back to budget if scope changes
  implementado: [],
  no_aprobado: ["solicitud"], // Can reactivate
  cancelado: ["solicitud"],   // Can reactivate
};

export function BotRequestDetailDialog({
  request,
  activityLog,
  open,
  onOpenChange,
  onUpdated,
  isAdmin,
}: BotRequestDetailDialogProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  // Edit fields (admin only)
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [budgetScope, setBudgetScope] = useState("");
  const [budgetTime, setBudgetTime] = useState("");
  const [budgetPrice, setBudgetPrice] = useState("");
  const [budgetConditions, setBudgetConditions] = useState("");
  const [developmentNotes, setDevelopmentNotes] = useState("");
  const [n8nWorkflowId, setN8nWorkflowId] = useState("");
  const [qaNotes, setQaNotes] = useState("");
  const [activationNotes, setActivationNotes] = useState("");
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  if (!request) return null;

  const validTransitions = VALID_TRANSITIONS[request.status] || [];

  const handleStatusChange = async (newStatus: BotRequestStatus) => {
    setIsUpdating(true);
    try {
      const updateData: Record<string, any> = { status: newStatus };

      // Add timestamps based on transitions
      switch (newStatus) {
        case "diagnostico":
          updateData.diagnosis_date = new Date().toISOString();
          if (diagnosisNotes) updateData.diagnosis_notes = diagnosisNotes;
          break;
        case "presupuesto_enviado":
          updateData.budget_sent_at = new Date().toISOString();
          if (budgetScope) updateData.budget_scope = budgetScope;
          if (budgetTime) updateData.budget_estimated_time = budgetTime;
          if (budgetPrice) updateData.budget_price = parseFloat(budgetPrice);
          if (budgetConditions) updateData.budget_conditions = budgetConditions;
          break;
        case "aprobado":
          updateData.approved_at = new Date().toISOString();
          updateData.payment_confirmed_at = new Date().toISOString();
          break;
        case "en_desarrollo":
          updateData.development_started_at = new Date().toISOString();
          if (n8nWorkflowId) updateData.n8n_workflow_id = n8nWorkflowId;
          if (developmentNotes) updateData.development_notes = developmentNotes;
          break;
        case "implementado":
          updateData.activated_at = new Date().toISOString();
          updateData.qa_completed_at = new Date().toISOString();
          if (qaNotes) updateData.qa_notes = qaNotes;
          if (activationNotes) updateData.activation_notes = activationNotes;
          if (documentationUrl) updateData.documentation_url = documentationUrl;
          break;
        case "no_aprobado":
          if (rejectionReason) updateData.rejection_reason = rejectionReason;
          break;
      }

      const { error } = await supabase
        .from("bot_implementation_requests" as any)
        .update(updateData as any)
        .eq("id", request.id);

      if (error) throw error;

      toast.success(`Estado actualizado a: ${BOT_REQUEST_STAGES.find(s => s.value === newStatus)?.label}`);
      onUpdated();
    } catch (error: any) {
      console.error("Error updating request:", error);
      toast.error("Error al actualizar el estado");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNotes = async (field: string, value: string) => {
    try {
      const { error } = await supabase
        .from("bot_implementation_requests" as any)
        .update({ [field]: value } as any)
        .eq("id", request.id);

      if (error) throw error;
      toast.success("Guardado exitosamente");
      onUpdated();
    } catch (error: any) {
      toast.error("Error al guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">{request.subject}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(request.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                </p>
              </div>
            </div>
            <BotRequestStatusBadge status={request.status} />
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Detalles</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            {isAdmin && <TabsTrigger value="budget">Presupuesto</TabsTrigger>}
            <TabsTrigger value="activity">Actividad</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Información de contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Nombre:</span>
                  <p className="font-medium">{request.contact_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{request.contact_email}</p>
                </div>
                {request.contact_phone && (
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>
                    <p className="font-medium">{request.contact_phone}</p>
                  </div>
                )}
                {request.company_name && (
                  <div>
                    <span className="text-muted-foreground">Empresa:</span>
                    <p className="font-medium">{request.company_name}</p>
                  </div>
                )}
                {request.preferred_schedule && (
                  <div>
                    <span className="text-muted-foreground">Disponibilidad:</span>
                    <p className="font-medium capitalize">{request.preferred_schedule}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Requerimiento del bot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Descripción:</span>
                  <p className="mt-1 whitespace-pre-wrap">{request.description}</p>
                </div>
                {request.bot_objectives && (
                  <div>
                    <span className="text-muted-foreground">Objetivos:</span>
                    <p className="mt-1 whitespace-pre-wrap">{request.bot_objectives}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Technical details - visible if available */}
            {(request.n8n_workflow_id || request.documentation_url || request.development_notes) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Code2 className="w-4 h-4" />
                    Detalles técnicos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {request.n8n_workflow_id && (
                    <div>
                      <span className="text-muted-foreground">n8n Workflow ID:</span>
                      <p className="font-mono">{request.n8n_workflow_id}</p>
                    </div>
                  )}
                  {request.development_notes && (
                    <div>
                      <span className="text-muted-foreground">Notas de desarrollo:</span>
                      <p className="mt-1 whitespace-pre-wrap">{request.development_notes}</p>
                    </div>
                  )}
                  {request.documentation_url && (
                    <div>
                      <span className="text-muted-foreground">Documentación:</span>
                      <a
                        href={request.documentation_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline block"
                      >
                        {request.documentation_url}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Pipeline Tab - Admin actions */}
          <TabsContent value="pipeline" className="space-y-4 mt-4">
            {/* Pipeline visual */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Progreso del pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {BOT_REQUEST_STAGES.filter(s => !["no_aprobado", "cancelado"].includes(s.value)).map((stage, idx, arr) => (
                    <div key={stage.value} className="flex items-center gap-2">
                      <div
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                          stage.value === request.status
                            ? stage.color + " ring-2 ring-offset-1 ring-primary/50"
                            : BOT_REQUEST_STAGES.findIndex(s => s.value === request.status) >=
                              BOT_REQUEST_STAGES.findIndex(s => s.value === stage.value)
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "bg-muted text-muted-foreground border-muted"
                        }`}
                      >
                        {stage.label}
                      </div>
                      {idx < arr.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Status transition actions (Admin only) */}
            {isAdmin && validTransitions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Avanzar pipeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Context-specific fields based on current status */}
                  {request.status === "solicitud" && (
                    <div className="space-y-2">
                      <Label>Notas del diagnóstico</Label>
                      <Textarea
                        value={diagnosisNotes}
                        onChange={(e) => setDiagnosisNotes(e.target.value)}
                        placeholder="Notas sobre los requerimientos del cliente..."
                      />
                    </div>
                  )}

                  {request.status === "diagnostico" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Alcance del bot</Label>
                          <Textarea
                            value={budgetScope}
                            onChange={(e) => setBudgetScope(e.target.value)}
                            placeholder="Descripción del alcance..."
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Condiciones</Label>
                          <Textarea
                            value={budgetConditions}
                            onChange={(e) => setBudgetConditions(e.target.value)}
                            placeholder="Condiciones del servicio..."
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Tiempo estimado</Label>
                          <Input
                            value={budgetTime}
                            onChange={(e) => setBudgetTime(e.target.value)}
                            placeholder="Ej: 2 semanas"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Precio (ARS)</Label>
                          <Input
                            type="number"
                            value={budgetPrice}
                            onChange={(e) => setBudgetPrice(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {request.status === "aprobado" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>n8n Workflow ID</Label>
                        <Input
                          value={n8nWorkflowId}
                          onChange={(e) => setN8nWorkflowId(e.target.value)}
                          placeholder="ID del workflow en n8n"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Notas de desarrollo</Label>
                        <Textarea
                          value={developmentNotes}
                          onChange={(e) => setDevelopmentNotes(e.target.value)}
                          placeholder="Notas sobre el desarrollo..."
                        />
                      </div>
                    </div>
                  )}

                  {request.status === "en_desarrollo" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Notas de QA</Label>
                        <Textarea
                          value={qaNotes}
                          onChange={(e) => setQaNotes(e.target.value)}
                          placeholder="Resultados de las pruebas..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Notas de activación</Label>
                        <Textarea
                          value={activationNotes}
                          onChange={(e) => setActivationNotes(e.target.value)}
                          placeholder="Detalles de la activación..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>URL de documentación</Label>
                        <Input
                          value={documentationUrl}
                          onChange={(e) => setDocumentationUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}

                  {request.status === "presupuesto_enviado" && (
                    <div className="space-y-2">
                      <Label>Razón de rechazo (si aplica)</Label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Motivo del rechazo..."
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    {validTransitions.map((nextStatus) => {
                      const stage = BOT_REQUEST_STAGES.find((s) => s.value === nextStatus);
                      if (!stage) return null;
                      const isNegative = ["no_aprobado", "cancelado"].includes(nextStatus);
                      return (
                        <Button
                          key={nextStatus}
                          onClick={() => handleStatusChange(nextStatus)}
                          disabled={isUpdating}
                          variant={isNegative ? "destructive" : "default"}
                          size="sm"
                          className={
                            !isNegative
                              ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                              : ""
                          }
                        >
                          <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                          Mover a: {stage.label}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline of key dates */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Línea de tiempo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <TimelineItem
                    label="Solicitud recibida"
                    date={request.created_at}
                    completed
                  />
                  <TimelineItem
                    label="Diagnóstico realizado"
                    date={request.diagnosis_date}
                    completed={!!request.diagnosis_date}
                  />
                  <TimelineItem
                    label="Presupuesto enviado"
                    date={request.budget_sent_at}
                    completed={!!request.budget_sent_at}
                  />
                  <TimelineItem
                    label="Aprobación y pago"
                    date={request.approved_at}
                    completed={!!request.approved_at}
                  />
                  <TimelineItem
                    label="Desarrollo iniciado"
                    date={request.development_started_at}
                    completed={!!request.development_started_at}
                  />
                  <TimelineItem
                    label="QA completado"
                    date={request.qa_completed_at}
                    completed={!!request.qa_completed_at}
                  />
                  <TimelineItem
                    label="Bot activado"
                    date={request.activated_at}
                    completed={!!request.activated_at}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Budget Tab - Admin */}
          {isAdmin && (
            <TabsContent value="budget" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Presupuesto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {request.budget_scope && (
                    <div>
                      <span className="text-muted-foreground">Alcance:</span>
                      <p className="mt-1 whitespace-pre-wrap">{request.budget_scope}</p>
                    </div>
                  )}
                  {request.budget_estimated_time && (
                    <div>
                      <span className="text-muted-foreground">Tiempo estimado:</span>
                      <p className="font-medium">{request.budget_estimated_time}</p>
                    </div>
                  )}
                  {request.budget_price != null && (
                    <div>
                      <span className="text-muted-foreground">Precio:</span>
                      <p className="text-lg font-bold text-primary">
                        ${request.budget_price.toLocaleString("es-AR")} ARS
                      </p>
                    </div>
                  )}
                  {request.budget_conditions && (
                    <div>
                      <span className="text-muted-foreground">Condiciones:</span>
                      <p className="mt-1 whitespace-pre-wrap">{request.budget_conditions}</p>
                    </div>
                  )}
                  {request.budget_sent_at && (
                    <div>
                      <span className="text-muted-foreground">Enviado el:</span>
                      <p>
                        {format(new Date(request.budget_sent_at), "dd MMM yyyy, HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                  )}
                  {request.payment_confirmed_at && (
                    <div>
                      <span className="text-muted-foreground">Pago confirmado:</span>
                      <p className="text-green-600 font-medium">
                        {format(new Date(request.payment_confirmed_at), "dd MMM yyyy, HH:mm", {
                          locale: es,
                        })}
                      </p>
                    </div>
                  )}
                  {request.rejection_reason && (
                    <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                      <span className="text-red-700 dark:text-red-400 font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Razón de rechazo:
                      </span>
                      <p className="mt-1 text-red-600 dark:text-red-300">
                        {request.rejection_reason}
                      </p>
                    </div>
                  )}
                  {!request.budget_scope && !request.budget_price && (
                    <p className="text-muted-foreground italic">
                      Presupuesto aún no definido
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Activity Log Tab */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Historial de actividad</CardTitle>
              </CardHeader>
              <CardContent>
                {activityLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sin actividad registrada</p>
                ) : (
                  <div className="space-y-3">
                    {activityLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 pb-3 border-b last:border-0"
                      >
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium">
                            {entry.action === "status_change" ? (
                              <>
                                Estado cambiado de{" "}
                                <Badge variant="outline" className="text-[10px] mx-1">
                                  {entry.from_status}
                                </Badge>
                                a{" "}
                                <Badge variant="outline" className="text-[10px] mx-1">
                                  {entry.to_status}
                                </Badge>
                              </>
                            ) : (
                              entry.action
                            )}
                          </p>
                          {entry.notes && (
                            <p className="text-muted-foreground mt-1">{entry.notes}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(entry.created_at), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Timeline item helper
function TimelineItem({
  label,
  date,
  completed,
}: {
  label: string;
  date: string | null;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-3 h-3 rounded-full border-2 shrink-0 ${
          completed
            ? "bg-primary border-primary"
            : "bg-background border-muted-foreground/30"
        }`}
      />
      <div className="flex-1 flex items-center justify-between">
        <span className={completed ? "font-medium" : "text-muted-foreground"}>
          {label}
        </span>
        {date && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es })}
          </span>
        )}
      </div>
    </div>
  );
}
