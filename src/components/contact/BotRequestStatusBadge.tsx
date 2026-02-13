import { BotRequestStatus } from "@/types/botRequests";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Phone,
  Send,
  CheckCircle2,
  Code2,
  Rocket,
  XCircle,
  Ban,
} from "lucide-react";

const statusConfig: Record<
  BotRequestStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  solicitud: {
    label: "Solicitud",
    icon: FileText,
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  },
  diagnostico: {
    label: "Diagnóstico",
    icon: Phone,
    className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  },
  presupuesto_enviado: {
    label: "Presupuesto Enviado",
    icon: Send,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  aprobado: {
    label: "Aprobado",
    icon: CheckCircle2,
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  },
  en_desarrollo: {
    label: "En Desarrollo",
    icon: Code2,
    className: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  },
  implementado: {
    label: "Implementado",
    icon: Rocket,
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  no_aprobado: {
    label: "No Aprobado",
    icon: XCircle,
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  },
  cancelado: {
    label: "Cancelado",
    icon: Ban,
    className: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300",
  },
};

interface BotRequestStatusBadgeProps {
  status: BotRequestStatus;
  size?: "sm" | "default";
}

export function BotRequestStatusBadge({ status, size = "default" }: BotRequestStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.className} ${
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
      } gap-1 font-medium border`}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {config.label}
    </Badge>
  );
}
