import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PresetForm } from "./preset-form";
import { PresetList } from "./preset-list";
import { AutoReportPreset } from "./types";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

const STORAGE_KEY = "auto_reports_presets_v2";

export function AutoReportsCard() {
  const [items, setItems] = useState<AutoReportPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [editing, setEditing] = useState<AutoReportPreset | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as AutoReportPreset[] : [];
      setItems(parsed);
    } catch (e) {
      setError(new Error("Failed to load presets"));
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = (next: AutoReportPreset[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error(e);
      setError(new Error("Failed to persist presets"));
    }
  };

  const handleCreate = (data: { name: string; frequency: any }) => {
    setLoading(true);
    try {
      const newItem: AutoReportPreset = { id: uuidv4(), name: data.name, frequency: data.frequency, enabled: true, createdAt: new Date().toISOString() };
      const next = [newItem, ...items];
      persist(next);
      toast.success("Preset creado");
    } catch (e) {
      setError(new Error("Error al crear preset"));
      toast.error("No se pudo crear el preset");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    const next = items.map(i => i.id === id ? { ...i, enabled } : i);
    persist(next);
    toast.success(enabled ? "Preset activado" : "Preset desactivado");
  };

  const handleDelete = (id: string) => {
    const next = items.filter(i => i.id !== id);
    persist(next);
    toast.success("Preset eliminado");
  };

  const handleEdit = (preset: AutoReportPreset) => {
    setEditing(preset);
  };

  const handleSaveEdit = (data: { name: string; frequency: any }) => {
    if (!editing) return;
    const next = items.map(i => i.id === editing.id ? { ...i, name: data.name, frequency: data.frequency } : i);
    persist(next);
    setEditing(null);
    toast.success("Preset actualizado");
  };

  return (
    <Card className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <CardHeader>
        <CardTitle className="text-[20px] font-semibold text-gray-900">Administrar reportes automáticos</CardTitle>
        <p className="text-sm text-gray-500">Crea, programa y gestiona tus reportes</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <PresetForm onSubmit={editing ? handleSaveEdit : handleCreate} defaultValues={editing ? { name: editing.name, frequency: editing.frequency } : undefined} isEditing={!!editing} />

          <PresetList items={items} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggle} isLoading={loading} error={error} />
        </div>
      </CardContent>
    </Card>
  );
}
