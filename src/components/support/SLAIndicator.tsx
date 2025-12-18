import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { differenceInHours, parseISO } from "date-fns";

interface SLAIndicatorProps {
  ticket: {
    created_at: string;
    first_response_at?: string | null;
    resolved_at?: string | null;
    sla_response_hours?: number;
    sla_resolution_hours?: number;
    sla_response_breached?: boolean;
    sla_resolution_breached?: boolean;
    status: string;
  };
}

export function SLAIndicator({ ticket }: SLAIndicatorProps) {
  const now = new Date();
  const createdAt = parseISO(ticket.created_at);
  const responseHours = ticket.sla_response_hours || 24;
  const resolutionHours = ticket.sla_resolution_hours || 72;

  // Calculate time since creation
  const hoursSinceCreation = differenceInHours(now, createdAt);

  // Response SLA status
  const responseDeadline = responseHours;
  const hasResponded = !!ticket.first_response_at;
  const responseBreached = ticket.sla_response_breached || (!hasResponded && hoursSinceCreation > responseDeadline);
  const responseTimeLeft = responseDeadline - hoursSinceCreation;

  // Resolution SLA status
  const resolutionDeadline = resolutionHours;
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
  const resolutionBreached = ticket.sla_resolution_breached || (!isResolved && hoursSinceCreation > resolutionDeadline);
  const resolutionTimeLeft = resolutionDeadline - hoursSinceCreation;

  // Determine overall status
  const getOverallStatus = () => {
    if (responseBreached || resolutionBreached) {
      return { status: 'breached', color: 'destructive', icon: AlertTriangle };
    }
    if (isResolved && hasResponded) {
      return { status: 'ok', color: 'success', icon: CheckCircle };
    }
    if (responseTimeLeft < 4 || resolutionTimeLeft < 8) {
      return { status: 'warning', color: 'warning', icon: Clock };
    }
    return { status: 'ok', color: 'secondary', icon: Clock };
  };

  const overall = getOverallStatus();
  const Icon = overall.icon;

  const formatTimeLeft = (hours: number) => {
    if (hours <= 0) return "Vencido";
    if (hours < 1) return "< 1h";
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={overall.color === 'destructive' ? 'destructive' : overall.color === 'warning' ? 'outline' : 'secondary'}
            className={`cursor-help ${overall.color === 'warning' ? 'border-yellow-500 text-yellow-600' : ''}`}
          >
            <Icon className="h-3 w-3 mr-1" />
            SLA
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="w-64">
          <div className="space-y-2 text-sm">
            <div className="font-semibold">Estado del SLA</div>
            
            <div className="flex items-center justify-between">
              <span>Primera respuesta:</span>
              <span className={hasResponded ? 'text-green-600' : responseBreached ? 'text-red-600' : ''}>
                {hasResponded ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Respondido
                  </span>
                ) : responseBreached ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Vencido
                  </span>
                ) : (
                  `${formatTimeLeft(responseTimeLeft)} restantes`
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Resolución:</span>
              <span className={isResolved ? 'text-green-600' : resolutionBreached ? 'text-red-600' : ''}>
                {isResolved ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Resuelto
                  </span>
                ) : resolutionBreached ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Vencido
                  </span>
                ) : (
                  `${formatTimeLeft(resolutionTimeLeft)} restantes`
                )}
              </span>
            </div>

            <div className="text-xs text-muted-foreground pt-1 border-t">
              Objetivo: Respuesta en {responseHours}h, Resolución en {resolutionHours}h
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
