import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import { PresetListProps } from "./types";
import { PresetCard } from "./preset-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PresetList({ items, onEdit, onDelete, onToggle, isLoading, error }: PresetListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar los presets.{" "}
          <Button 
            variant="link" 
            className="h-auto p-0 text-red-600 hover:text-red-700"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center">
        <CalendarClock className="h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-sm font-medium text-gray-900">
          Aún no tienes reportes automáticos creados
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Crea tu primer preset para comenzar a programar reportes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((preset) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          onEdit={() => onEdit(preset)}
          onDelete={() => onDelete(preset.id)}
          onToggle={(enabled) => onToggle(preset.id, enabled)}
        />
      ))}
    </div>
  );
}