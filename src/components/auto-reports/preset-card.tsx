import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Edit, Trash2 } from "lucide-react";
import { PresetCardProps } from "./types";

const frequencyLabel = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

export function PresetCard({ preset, onEdit, onDelete, onToggle }: PresetCardProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4",
        "transition-all duration-200 hover:border-emerald-400 hover:shadow-sm",
        "focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20"
      )}
    >
      <div className="flex items-center gap-4">
        <div>
          <h3 className="text-[14px] font-medium text-gray-900">
            {preset.name}
          </h3>
          <p className="text-[12px] text-gray-500">
            {frequencyLabel[preset.frequency]}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={preset.enabled}
          onCheckedChange={onToggle}
          aria-label={`Activar preset ${preset.name}`}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="h-9 w-9 p-0"
          aria-label={`Editar preset ${preset.name}`}
        >
          <Edit className="h-[18px] w-[18px]" />
        </Button>
        <DeletePresetDialog preset={preset} onConfirm={onDelete} />
      </div>
    </div>
  );
}

function DeletePresetDialog({ preset, onConfirm }: { preset: { id: string; name: string }, onConfirm: (id: string) => void }) {
  return (
    <AlertDialog>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-600"
        aria-label={`Eliminar preset ${preset.name}`}
      >
        <Trash2 className="h-[18px] w-[18px]" />
      </Button>

      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar preset</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar el preset '{preset.name}'? Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(preset.id)}
            className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}