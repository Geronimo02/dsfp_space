// Types for the Bot Implementation Request pipeline

export type BotRequestStatus =
  | 'solicitud'
  | 'diagnostico'
  | 'presupuesto_enviado'
  | 'aprobado'
  | 'en_desarrollo'
  | 'implementado'
  | 'no_aprobado'
  | 'cancelado';

export interface BotImplementationRequest {
  id: string;
  company_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  company_name: string | null;
  subject: string;
  description: string;
  bot_objectives: string | null;
  preferred_schedule: string | null;
  status: BotRequestStatus;
  assigned_to: string | null;
  diagnosis_notes: string | null;
  diagnosis_date: string | null;
  budget_scope: string | null;
  budget_estimated_time: string | null;
  budget_price: number | null;
  budget_conditions: string | null;
  budget_sent_at: string | null;
  budget_document_url: string | null;
  approved_at: string | null;
  payment_confirmed_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  rejection_reason: string | null;
  development_started_at: string | null;
  n8n_workflow_id: string | null;
  development_notes: string | null;
  qa_completed_at: string | null;
  qa_notes: string | null;
  activated_at: string | null;
  activation_notes: string | null;
  documentation_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotRequestActivityLog {
  id: string;
  request_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface BotRequestFormData {
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  company_name: string;
  subject: string;
  description: string;
  bot_objectives: string;
  preferred_schedule: string;
}

// Pipeline stage display configuration
export const BOT_REQUEST_STAGES: {
  value: BotRequestStatus;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'solicitud',
    label: 'Solicitud',
    description: 'Solicitud recibida, pendiente de contacto',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    value: 'diagnostico',
    label: 'Diagnóstico',
    description: 'Llamada de diagnóstico programada o realizada',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    value: 'presupuesto_enviado',
    label: 'Presupuesto Enviado',
    description: 'Presupuesto formal enviado al cliente',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  {
    value: 'aprobado',
    label: 'Aprobado',
    description: 'Presupuesto aprobado y pago confirmado',
    color: 'bg-green-100 text-green-800 border-green-200',
  },
  {
    value: 'en_desarrollo',
    label: 'En Desarrollo',
    description: 'Bot en desarrollo en n8n',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  {
    value: 'implementado',
    label: 'Implementado',
    description: 'Bot implementado y activo en Ventify',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    value: 'no_aprobado',
    label: 'No Aprobado',
    description: 'Presupuesto no aprobado por el cliente',
    color: 'bg-red-100 text-red-800 border-red-200',
  },
  {
    value: 'cancelado',
    label: 'Cancelado',
    description: 'Solicitud cancelada',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
  },
];

export function getStageConfig(status: BotRequestStatus) {
  return BOT_REQUEST_STAGES.find((s) => s.value === status) ?? BOT_REQUEST_STAGES[0];
}
