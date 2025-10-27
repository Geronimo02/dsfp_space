import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AutoReportFormData, Frequency, PresetFormProps } from "./types";

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

export function PresetForm({ onSubmit, defaultValues, isEditing }: PresetFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [frequency, setFrequency] = useState<Frequency>(defaultValues?.frequency ?? "weekly");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: AutoReportFormData = { name: name.trim(), frequency };
    onSubmit(data);
    if (!isEditing) {
      setName("");
      setFrequency("weekly");
    }
  };

  const isValid = name.trim().length >= 3;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_140px] gap-3 items-end">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Reporte semanal"
            className="h-11 rounded-lg"
            minLength={3}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="frequency">Frecuencia</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
            <SelectTrigger id="frequency" className="h-11 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="submit"
          disabled={!isValid}
          className="h-11 rounded-lg bg-emerald-500 hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          title="Guardará y programará el reporte según la frecuencia"
        >
          <Plus className="mr-2 h-5 w-5" />
          {isEditing ? "Guardar cambios" : "Crear preset"}
        </Button>
      </div>
    </form>
  );
}