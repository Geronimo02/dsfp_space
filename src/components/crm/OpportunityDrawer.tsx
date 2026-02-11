import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Plus, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type OpportunityRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];
type OpportunityInsert = Database["public"]["Tables"]["crm_opportunities"]["Insert"];

const opportunitySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  customer_id: z.string().optional(),
  pipeline_id: z.string().min(1, "Pipeline es requerido"),
  stage: z.string().min(1, "Etapa es requerida"),
  value: z.number().optional(),
  estimated_close_date: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  description: z.string().optional(),
  owner_id: z.string().optional(),
  status: z.string().optional(),
  close_date: z.string().optional(),
  lost_reason: z.string().optional(),
  won_reason: z.string().optional(),
  source: z.string().optional(),
  currency: z.string().optional(),
  expected_revenue: z.number().optional(),
  next_step: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type OpportunityForm = z.infer<typeof opportunitySchema>;

interface TagRow {
  id: string;
  name: string;
  color: string;
}

const TAG_COLOR_PALETTE = [
  "rgb(59, 130, 246)",
  "rgb(16, 185, 129)",
  "rgb(239, 68, 68)",
  "rgb(234, 179, 8)",
  "rgb(168, 85, 247)",
  "rgb(14, 165, 233)",
  "rgb(244, 63, 94)",
  "rgb(34, 197, 94)",
  "rgb(249, 115, 22)",
  "rgb(99, 102, 241)",
];

const normalizeColor = (color: string) => color.replace(/\s+/g, "").toLowerCase();

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  if (Number.isNaN(bigint)) return "rgb(59, 130, 246)";
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgb(${r}, ${g}, ${b})`;
};

const rgbToHex = (rgb: string) => {
  if (rgb.startsWith("#")) return rgb;
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return "#3b82f6";
  const [r, g, b] = match.map((v) => Number(v));
  return `#${[r, g, b]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;
};

interface OpportunityDrawerProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  opportunity?: OpportunityRow | null;
}

export function OpportunityDrawer({ open, onClose, companyId, opportunity }: OpportunityDrawerProps) {
  const queryClient = useQueryClient();
  const isEditing = !!opportunity;

  const form = useForm<OpportunityForm>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: {
      probability: 50,
      status: "abierta",
      currency: "ARS",
      tags: [],
    },
    mode: "onChange",
  });

  const mutation = useMutation({
    mutationFn: async (values: OpportunityForm) => {
      const normalizeNumber = (val?: number) =>
        typeof val === "number" && !Number.isNaN(val) ? val : null;
      const normalizeText = (val?: string) => (val && val.trim() ? val : null);

      const payload: any = {
        name: values.name,
        customer_id: values.customer_id || null,
        pipeline_id: values.pipeline_id || null,
        stage: values.stage,
        value: normalizeNumber(values.value),
        estimated_close_date: normalizeText(values.estimated_close_date),
        probability: normalizeNumber(values.probability),
        description: normalizeText(values.description),
        owner_id: values.owner_id || null,
        status: normalizeText(values.status),
        close_date: normalizeText(values.close_date),
        lost_reason: normalizeText(values.lost_reason),
        won_reason: normalizeText(values.won_reason),
        source: normalizeText(values.source),
        currency: normalizeText(values.currency),
        expected_revenue: normalizeNumber(values.expected_revenue),
        next_step: normalizeText(values.next_step),
        tags: values.tags && values.tags.length ? values.tags : null,
      };

      if (isEditing) {
        const { data, error } = await supabase
          .from("crm_opportunities")
          .update(payload)
          .eq("id", opportunity!.id)
          .select();
        if (error) {
          console.error("Error updating opportunity:", error);
          throw error;
        }
        console.log("Updated opportunity:", data);
      } else {
        const { data, error } = await supabase
          .from("crm_opportunities")
          .insert([{ ...payload, company_id: companyId }])
          .select();
        if (error) {
          console.error("Error creating opportunity:", error);
          throw error;
        }
        console.log("Created opportunity:", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      toast.success(isEditing ? "Oportunidad actualizada" : "Oportunidad creada");
      onClose();
    },
    onError: (error: any) => {
      console.error("Mutation error:", error);
      toast.error(error.message || "Error al guardar oportunidad");
    },
  });

  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ["crm-pipelines", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("id, name, stages")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const { data: owners = [], isLoading: ownersLoading } = useQuery({
    queryKey: ["crm-owners", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("company_id", companyId)
        .order("first_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const { data: tags = [] } = useQuery<TagRow[]>({
    queryKey: ["crm-tags", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tags")
        .select("id, name, color")
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as TagRow[];
    },
    enabled: !!companyId && open,
  });

  const [tagSearch, setTagSearch] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColorHex, setNewTagColorHex] = useState("");

  const selectedTags = form.watch("tags") || [];
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return tags;
    const needle = tagSearch.trim().toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(needle));
  }, [tags, tagSearch]);

  const suggestedColor = useMemo(() => {
    const existing = new Set(tags.map((t) => normalizeColor(t.color)));
    const next = TAG_COLOR_PALETTE.find((color) => !existing.has(normalizeColor(color)));
    return next || TAG_COLOR_PALETTE[0];
  }, [tags]);

  useEffect(() => {
    if (!newTagColorHex) {
      setNewTagColorHex(rgbToHex(suggestedColor));
    }
  }, [suggestedColor, newTagColorHex]);

  const setSelectedTags = (next: string[]) => {
    form.setValue("tags", next, { shouldValidate: true });
  };

  const addTag = (name: string) => {
    if (selectedTagSet.has(name)) return;
    setSelectedTags([...selectedTags, name]);
  };

  const removeTag = (name: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag !== name));
  };

  const toggleTag = (name: string) => {
    if (selectedTagSet.has(name)) {
      removeTag(name);
    } else {
      addTag(name);
    }
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) {
      toast.error("El nombre del tag es requerido");
      return;
    }
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      addTag(existing.name);
      setNewTagName("");
      setTagSearch("");
      return;
    }
    const colorRgb = hexToRgb(newTagColorHex || rgbToHex(suggestedColor));
    createTagMutation.mutate({ name, color: colorRgb });
  };

  const createTagMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from("crm_tags")
        .insert([{ company_id: companyId, name, color }])
        .select("id, name, color")
        .single();
      if (error) throw error;
      return data as TagRow;
    },
    onSuccess: (newTag) => {
      queryClient.invalidateQueries({ queryKey: ["crm-tags", companyId] });
      addTag(newTag.name);
      setNewTagName("");
      setTagSearch("");
      setNewTagColorHex("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear tag");
    },
  });

  const updateTagColorMutation = useMutation({
    mutationFn: async ({ tagId, color }: { tagId: string; color: string }) => {
      const { error } = await supabase
        .from("crm_tags")
        .update({ color })
        .eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-tags", companyId] });
    },
  });

  const selectedPipelineId = form.watch("pipeline_id");
  const selectedPipeline = useMemo(
    () => pipelines.find((p: any) => p.id === selectedPipelineId),
    [pipelines, selectedPipelineId]
  );
  const pipelineStages: string[] = selectedPipeline?.stages ?? [];

  // Populate form when editing - wait for data to load first
  useEffect(() => {
    if (!open) return;
    
    // Don't populate form until queries finish loading
    if (isEditing && (pipelinesLoading || customersLoading || ownersLoading)) {
      console.log("Waiting for data to load...");
      return;
    }

    if (opportunity && isEditing) {
      console.log("Loading opportunity for edit:", opportunity);
      const formValues = {
        name: opportunity.name || "",
        customer_id: opportunity.customer_id || undefined,
        pipeline_id: opportunity.pipeline_id || undefined,
        stage: opportunity.stage || "",
        value: opportunity.value ?? undefined,
        estimated_close_date: opportunity.estimated_close_date || undefined,
        probability: opportunity.probability ?? 50,
        description: opportunity.description || "",
        owner_id: opportunity.owner_id || undefined,
        status: opportunity.status || "abierta",
        close_date: opportunity.close_date || undefined,
        lost_reason: opportunity.lost_reason || "",
        won_reason: opportunity.won_reason || "",
        source: opportunity.source || "",
        currency: opportunity.currency || "ARS",
        expected_revenue: opportunity.expected_revenue ?? undefined,
        next_step: opportunity.next_step || "",
        tags: opportunity.tags || [],
      };
      console.log("Form values to reset:", formValues);
      form.reset(formValues);
    } else if (!opportunity && !isEditing) {
      form.reset({
        name: "",
        probability: 50,
        status: "abierta",
        currency: "ARS",
        description: "",
        next_step: "",
        source: "",
        tags: [],
        lost_reason: "",
        won_reason: "",
      });
    }
  }, [opportunity, open, isEditing, pipelinesLoading, customersLoading, ownersLoading, form]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white h-full shadow-xl animate-in slide-in-from-right duration-300 outline-none flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{isEditing ? "Editar oportunidad" : "Nueva oportunidad"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            ×
          </Button>
        </div>
        <form
          className="flex-1 overflow-y-auto p-4 grid gap-4"
          onSubmit={form.handleSubmit(
            (values) => {
              console.log("Form submitted with values:", values);
              mutation.mutate(values);
            },
            (errors) => {
              console.log("Form validation errors:", errors);
              toast.error("Hay errores en el formulario");
            }
          )}
        >
          <div className="text-xs text-muted-foreground">
            Los campos con * son obligatorios.
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Datos básicos</div>
          <div className="grid gap-2">
            <label className="font-medium">Nombre *</label>
            <Input
              {...form.register("name")}
              placeholder="Ej: Renovación contrato ACME"
              aria-invalid={!!form.formState.errors.name}
            />
            {form.formState.errors.name && (
              <span className="text-xs text-red-500">{form.formState.errors.name.message}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Pipeline *</label>
              <Select
                value={form.watch("pipeline_id") || ""}
                onValueChange={(value) => {
                  form.setValue("pipeline_id", value, { shouldValidate: true });
                  const pipeline = pipelines.find((p: any) => p.id === value);
                  const nextStage = pipeline?.stages?.[0];
                  if (nextStage && !isEditing) {
                    form.setValue("stage", nextStage, { shouldValidate: true });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elegí un pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-medium">Etapa *</label>
              <Select
                value={form.watch("stage") || ""}
                onValueChange={(value) => form.setValue("stage", value, { shouldValidate: true })}
                disabled={!pipelineStages.length}
              >
                <SelectTrigger>
                  <SelectValue placeholder={pipelineStages.length ? "Seleccionar" : "Elegí pipeline"} />
                </SelectTrigger>
                <SelectContent>
                  {pipelineStages.map((stage: string) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Cliente</label>
              <Select
                value={form.watch("customer_id") || "__none__"}
                onValueChange={(value) =>
                  form.setValue("customer_id", value === "__none__" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin cliente</SelectItem>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-medium">Responsable (empleado)</label>
              <Select
                value={form.watch("owner_id") || "__none__"}
                onValueChange={(value) =>
                  form.setValue("owner_id", value === "__none__" ? undefined : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin asignar</SelectItem>
                  {owners.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {`${o.first_name} ${o.last_name}`.trim()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Puede quedar vacío.</p>
            </div>
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Monto y fechas</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Monto</label>
              <Input
                type="number"
                {...form.register("value", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
            <div>
              <label className="font-medium">Moneda</label>
              <Select
                value={form.watch("currency") || "ARS"}
                onValueChange={(value) => form.setValue("currency", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="CLP">CLP</SelectItem>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="PEN">PEN</SelectItem>
                  <SelectItem value="UYU">UYU</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-medium">Cierre estimado</label>
              <Input type="date" {...form.register("estimated_close_date")} />
            </div>
            <div>
              <label className="font-medium">Probabilidad (%)</label>
              <Input
                type="number"
                {...form.register("probability", { valueAsNumber: true })}
                placeholder="50"
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Estado y seguimiento</div>
          <div className="grid gap-2">
            <label className="font-medium">Estado</label>
            <Select
              value={form.watch("status") || "abierta"}
              onValueChange={(value) => form.setValue("status", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="abierta">Abierta</SelectItem>
                <SelectItem value="ganado">Ganado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="font-medium">Próximo paso</label>
            <Input {...form.register("next_step")} placeholder="Agendar reunión..." />
          </div>

          <div className="text-sm font-semibold text-muted-foreground">Notas</div>
          <div className="grid gap-2">
            <label className="font-medium">Descripción</label>
            <Textarea
              {...form.register("description")}
              placeholder="Detalles de la oportunidad..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <label className="font-medium">Fuente</label>
            <Input {...form.register("source")} placeholder="Ej: Web, Referido, Email..." />
          </div>

          <div className="grid gap-2">
            <label className="font-medium">Tags</label>
            <div className="flex flex-wrap gap-2">
              {selectedTags.length === 0 ? (
                <span className="text-xs text-muted-foreground">Sin tags asignados.</span>
              ) : (
                selectedTags.map((tagName) => {
                  const tag = tags.find((t) => t.name === tagName);
                  const tagColor = tag?.color || "rgb(148, 163, 184)";
                  return (
                    <Badge
                      key={tagName}
                      className="gap-1 text-white"
                      style={{ backgroundColor: tagColor }}
                    >
                      {tagName}
                      <button
                        type="button"
                        className="ml-1 rounded-full hover:bg-black/20"
                        onClick={() => removeTag(tagName)}
                        aria-label={`Quitar ${tagName}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })
              )}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-fit">
                  Gestionar tags
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Buscar tags</label>
                    <Input
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      placeholder="Buscar tag..."
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {filteredTags.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No hay tags.
                      </div>
                    ) : (
                      filteredTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.name)}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span>{tag.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              value={rgbToHex(tag.color)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const nextColor = hexToRgb(e.target.value);
                                updateTagColorMutation.mutate({ tagId: tag.id, color: nextColor });
                              }}
                              className="h-6 w-8 p-0"
                            />
                            {selectedTagSet.has(tag.name) && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="space-y-2 border-t pt-3">
                    <label className="text-xs font-medium text-muted-foreground">Crear tag</label>
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Ej: urgente"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={newTagColorHex || rgbToHex(suggestedColor)}
                        onChange={(e) => setNewTagColorHex(e.target.value)}
                        className="h-9 w-12 p-1"
                      />
                      <span className="text-xs text-muted-foreground">Color sugerido</span>
                      <Button
                        type="button"
                        size="sm"
                        className="ml-auto"
                        onClick={handleCreateTag}
                        disabled={createTagMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Crear
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="sticky bottom-0 bg-white border-t pt-4 flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
