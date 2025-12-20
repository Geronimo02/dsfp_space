import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Pause,
  ArrowUp,
  HelpCircle,
  XCircle
} from "lucide-react";

interface TicketStatusBadgeProps {
  status: string;
  waitingForCustomer?: boolean;
  escalated?: boolean;
}

export function TicketStatusBadge({ 
  status, 
  waitingForCustomer, 
  escalated 
}: TicketStatusBadgeProps) {
  // If waiting for customer, show that status
  if (waitingForCustomer) {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        <Pause className="h-3 w-3 mr-1" />
        Esperando Info
      </Badge>
    );
  }

  // If escalated, show that
  if (escalated) {
    return (
      <Badge variant="destructive" className="bg-orange-500">
        <ArrowUp className="h-3 w-3 mr-1" />
        Escalado
      </Badge>
    );
  }

  const statusConfig: Record<string, { 
    variant: "default" | "secondary" | "destructive" | "outline"; 
    label: string; 
    icon: React.ReactNode;
    className?: string;
  }> = {
    open: { 
      variant: "default", 
      label: "Abierto", 
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      className: "bg-red-500 hover:bg-red-600"
    },
    in_progress: { 
      variant: "secondary", 
      label: "En Progreso", 
      icon: <Clock className="h-3 w-3 mr-1" />,
      className: "bg-blue-500 text-white hover:bg-blue-600"
    },
    pending: { 
      variant: "outline", 
      label: "Pendiente", 
      icon: <HelpCircle className="h-3 w-3 mr-1" /> 
    },
    waiting_info: { 
      variant: "outline", 
      label: "Esperando Info", 
      icon: <Pause className="h-3 w-3 mr-1" />,
      className: "bg-yellow-50 text-yellow-700 border-yellow-200"
    },
    escalated: { 
      variant: "destructive", 
      label: "Escalado", 
      icon: <ArrowUp className="h-3 w-3 mr-1" />,
      className: "bg-orange-500"
    },
    resolved: { 
      variant: "default", 
      label: "Resuelto", 
      icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
      className: "bg-green-500 hover:bg-green-600"
    },
    closed: { 
      variant: "outline", 
      label: "Cerrado", 
      icon: <XCircle className="h-3 w-3 mr-1" /> 
    },
  };

  const config = statusConfig[status] || statusConfig.open;

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function getPriorityBadge(priority: string, autoPriorityReason?: string) {
  const priorityConfig: Record<string, { 
    label: string; 
    emoji: string;
    className: string;
  }> = {
    low: { label: "Baja", emoji: "🟢", className: "bg-green-50 text-green-700 border-green-200" },
    medium: { label: "Media", emoji: "🟡", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    high: { label: "Alta", emoji: "🟠", className: "bg-orange-50 text-orange-700 border-orange-200" },
    urgent: { label: "Urgente", emoji: "🔴", className: "bg-red-50 text-red-700 border-red-200" },
  };

  const config = priorityConfig[priority] || priorityConfig.medium;

  return (
    <Badge variant="outline" className={config.className} title={autoPriorityReason}>
      {config.emoji} {config.label}
    </Badge>
  );
}
