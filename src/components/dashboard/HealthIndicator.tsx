import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface HealthIndicatorProps {
  title: string;
  status: "healthy" | "warning" | "critical";
  value: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
}

const statusConfig = {
  healthy: {
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    icon: "text-green-600 dark:text-green-500",
    badge: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
    border: "border-yellow-200 dark:border-yellow-800",
    icon: "text-yellow-600 dark:text-yellow-500",
    badge: "bg-yellow-500",
    text: "text-yellow-700 dark:text-yellow-400",
  },
  critical: {
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    icon: "text-red-600 dark:text-red-500",
    badge: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
};

export function HealthIndicator({
  title,
  status,
  value,
  description,
  icon: Icon,
  onClick,
}: HealthIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border p-4 transition-all",
        config.bg,
        config.border,
        onClick && "cursor-pointer hover:shadow-lg"
      )}
      onClick={onClick}
    >
      {/* Status indicator */}
      <div className="absolute top-0 right-0 w-2 h-full">
        <div className={cn("h-full", config.badge)} />
      </div>

      <div className="flex items-start gap-4">
        <div className={cn("p-2 rounded-lg", config.bg)}>
          <Icon className={cn("h-5 w-5", config.icon)} />
        </div>

        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn("text-2xl font-bold", config.text)}>{value}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
