import { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Plus, X, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { opportunitySchema, type OpportunityForm } from "@/domain/crm/validation/opportunitySchema";
import { opportunityService } from "@/domain/crm/services/opportunityService";
import { tagService } from "@/domain/crm/services/tagService";
import { activityService } from "@/domain/crm/services/activityService";
import { activityLogService } from "@/domain/crm/services/activityLogService";
import { messageTemplateService } from "@/domain/crm/services/messageTemplateService";
import { messageLogService } from "@/domain/crm/services/messageLogService";
import type { ActivityDTO, ActivityListResult } from "@/domain/crm/dtos/activity";
import type { ActivityLogListResult } from "@/domain/crm/dtos/activityLog";
import type { MessageLogDTO } from "@/domain/crm/dtos/messageLog";

type OpportunityRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];
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

const normalizeColorForCompare = (color: string) => {
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    return normalizeColor(hexToRgb(trimmed));
  }
  return normalizeColor(trimmed);
};

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
        await opportunityService.update(opportunity!.id, payload);
      } else {
        await opportunityService.create({ ...payload, company_id: companyId });
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["customers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, phone")
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: tags = [] } = useQuery<TagRow[]>({
    queryKey: ["crm-tags", companyId],
    queryFn: async () => {
      return (await tagService.list(companyId)) as TagRow[];
    },
    enabled: !!companyId && open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [tagSearch, setTagSearch] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColorHex, setNewTagColorHex] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [activityForm, setActivityForm] = useState({
    type: "call",
    subject: "",
    notes: "",
    due_at: "",
  });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [messageChannel, setMessageChannel] = useState<"email" | "whatsapp">("email");
  const [messageTemplateId, setMessageTemplateId] = useState<string>("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageRecipient, setMessageRecipient] = useState("");

  const selectedTags = form.watch("tags") || [];
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);
  const selectedCustomerId = form.watch("customer_id");
  const selectedCustomer = useMemo(
    () => customers.find((customer: any) => customer.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return tags;
    const needle = tagSearch.trim().toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(needle));
  }, [tags, tagSearch]);

  const suggestedColor = useMemo(() => {
    const existing = new Set(tags.map((t) => normalizeColorForCompare(t.color)));
    const next = TAG_COLOR_PALETTE.find(
      (color) => !existing.has(normalizeColorForCompare(color))
    );
    return next || TAG_COLOR_PALETTE[0];
  }, [tags]);

  const suggestedColorHex = useMemo(() => rgbToHex(suggestedColor), [suggestedColor]);
  const lastSuggestedRef = useRef(suggestedColorHex);

  useEffect(() => {
    const lastSuggested = lastSuggestedRef.current;
    const isAutoSelection =
      !newTagColorHex ||
      normalizeColorForCompare(hexToRgb(newTagColorHex)) ===
        normalizeColorForCompare(hexToRgb(lastSuggested));

    if (isAutoSelection) {
      setNewTagColorHex(suggestedColorHex);
    }

    lastSuggestedRef.current = suggestedColorHex;
  }, [suggestedColorHex, newTagColorHex]);

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

  const startEditTag = (tag: TagRow) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const cancelEditTag = () => {
    setEditingTagId(null);
    setEditingTagName("");
  };

  const saveEditTag = (tag: TagRow) => {
    const name = editingTagName.trim();
    if (!name) {
      toast.error("El nombre del tag es requerido");
      return;
    }
    if (name.toLowerCase() === tag.name.toLowerCase()) {
      cancelEditTag();
      return;
    }
    updateTagNameMutation.mutate({ tagId: tag.id, name, previousName: tag.name });
  };

  const handleDeleteTag = (tag: TagRow) => {
    if (!confirm(`¿Eliminar el tag "${tag.name}"?`)) return;
    deleteTagMutation.mutate({ tagId: tag.id, name: tag.name });
  };

  const createTagMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      return (await tagService.create({ company_id: companyId, name, color })) as TagRow;
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
      await tagService.update(tagId, { color });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-tags", companyId] });
    },
  });

  const updateTagNameMutation = useMutation({
    mutationFn: async ({ tagId, name }: { tagId: string; name: string; previousName?: string }) => {
      await tagService.update(tagId, { name });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["crm-tags", companyId] });
      if (variables.previousName && variables.previousName !== variables.name) {
        setSelectedTags(
          selectedTags.map((tag) => (tag === variables.previousName ? variables.name : tag))
        );
      }
      setEditingTagId(null);
      setEditingTagName("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al editar tag");
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async ({ tagId }: { tagId: string; name?: string }) => {
      await tagService.remove(tagId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["crm-tags", companyId] });
      if (variables.name) {
        removeTag(variables.name);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar tag");
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

  const { data: activityList } = useQuery<ActivityListResult>({
    queryKey: ["crm-activities", companyId, opportunity?.id, activityTypeFilter],
    queryFn: () =>
      activityService.listByOpportunity({
        companyId,
        opportunityId: opportunity?.id,
        type: activityTypeFilter === "all" ? undefined : activityTypeFilter,
        page: 1,
        pageSize: 50,
      }),
    enabled: !!companyId && !!opportunity?.id && open,
  });

  const { data: activityLogList } = useQuery<ActivityLogListResult>({
    queryKey: ["crm-activity-log", companyId, opportunity?.id],
    queryFn: () =>
      activityLogService.listByOpportunity({
        companyId,
        opportunityId: opportunity?.id,
        page: 1,
        pageSize: 50,
      }),
    enabled: !!companyId && !!opportunity?.id && open,
  });

  const { data: messageTemplates = [] } = useQuery({
    queryKey: ["crm-message-templates", companyId],
    queryFn: () => messageTemplateService.list(companyId),
    enabled: !!companyId && open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: messageLogs = [] } = useQuery({
    queryKey: ["crm-message-logs", companyId, opportunity?.id],
    queryFn: () =>
      messageLogService.listByOpportunity({
        companyId,
        opportunityId: opportunity!.id,
      }),
    enabled: !!companyId && !!opportunity?.id && open,
  });

  const filteredTemplates = useMemo(
    () => messageTemplates.filter((tpl: any) => tpl.channel === messageChannel),
    [messageTemplates, messageChannel]
  );

  useEffect(() => {
    if (!messageTemplateId) return;
    const template = messageTemplates.find((tpl: any) => tpl.id === messageTemplateId);
    if (!template) return;
    setMessageSubject(template.subject ?? "");
    setMessageBody(template.body ?? "");
  }, [messageTemplateId, messageTemplates]);

  useEffect(() => {
    if (!messageTemplateId) return;
    const exists = filteredTemplates.some((tpl: any) => tpl.id === messageTemplateId);
    if (!exists) setMessageTemplateId("");
  }, [filteredTemplates, messageTemplateId]);

  useEffect(() => {
    if (!selectedCustomer) return;
    const nextRecipient =
      messageChannel === "email" ? selectedCustomer.email : selectedCustomer.phone;
    if (!nextRecipient) return;
    if (!messageRecipient) {
      setMessageRecipient(nextRecipient);
    }
  }, [selectedCustomer, messageChannel, messageRecipient]);

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      if (!opportunity?.id) throw new Error("Oportunidad no seleccionada");
      return activityService.create({
        company_id: companyId,
        opportunity_id: opportunity.id,
        type: activityForm.type,
        subject: activityForm.subject || null,
        notes: activityForm.notes || null,
        due_at: activityForm.due_at || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["crm-activities", companyId, opportunity?.id],
      });
      setActivityForm({ type: "call", subject: "", notes: "", due_at: "" });
      setEditingActivityId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear actividad");
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async () => {
      if (!editingActivityId) throw new Error("Actividad no seleccionada");
      return activityService.update(editingActivityId, {
        type: activityForm.type,
        subject: activityForm.subject || null,
        notes: activityForm.notes || null,
        due_at: activityForm.due_at || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["crm-activities", companyId, opportunity?.id],
      });
      setActivityForm({ type: "call", subject: "", notes: "", due_at: "" });
      setEditingActivityId(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar actividad");
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await activityService.remove(activityId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["crm-activities", companyId, opportunity?.id],
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar actividad");
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      const name = window.prompt("Nombre de la plantilla");
      if (!name) throw new Error("Nombre requerido");
      return messageTemplateService.create({
        company_id: companyId,
        name: name.trim(),
        channel: messageChannel,
        subject: messageChannel === "email" ? messageSubject : null,
        body: messageBody,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-message-templates", companyId] });
      toast.success("Plantilla guardada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al guardar plantilla");
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!opportunity?.id) throw new Error("Oportunidad no seleccionada");
      if (!messageRecipient.trim()) throw new Error("Destinatario requerido");
      if (!messageBody.trim()) throw new Error("Contenido requerido");

      const { data: authData } = await supabase.auth.getUser();
      const createdBy = authData?.user?.id ?? null;

      const log = await messageLogService.create({
        company_id: companyId,
        opportunity_id: opportunity.id,
        customer_id: selectedCustomer?.id ?? null,
        channel: messageChannel,
        template_id: messageTemplateId || null,
        subject: messageChannel === "email" ? messageSubject || null : null,
        body: messageBody,
        recipient: messageRecipient,
        status: "queued",
        created_by: createdBy,
      });

      try {
        await messageLogService.sendMessage({
          logId: log.id,
          channel: messageChannel,
          recipient: messageRecipient,
          subject: messageChannel === "email" ? messageSubject : null,
          body: messageBody,
        });
      } catch (error: any) {
        await messageLogService.update(log.id, {
          status: "failed",
          error: error?.message || "Error al enviar",
        });
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["crm-message-logs", companyId, opportunity?.id],
      });
      toast.success("Mensaje enviado");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar mensaje");
      queryClient.invalidateQueries({
        queryKey: ["crm-message-logs", companyId, opportunity?.id],
      });
    },
  });

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

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Detalles</TabsTrigger>
              <TabsTrigger value="activity" className="flex-1">Actividad</TabsTrigger>
              <TabsTrigger value="history" className="flex-1">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
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
                          filteredTags.map((tag) => {
                            const isEditingTag = editingTagId === tag.id;
                            return (
                              <div
                                key={tag.id}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted"
                              >
                                {isEditingTag ? (
                                  <div className="flex flex-1 items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: tag.color }}
                                    />
                                    <Input
                                      value={editingTagName}
                                      onChange={(e) => setEditingTagName(e.target.value)}
                                      className="h-7"
                                    />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => toggleTag(tag.name)}
                                    className="flex flex-1 items-center gap-2 text-left"
                                  >
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: tag.color }}
                                    />
                                    <span>{tag.name}</span>
                                  </button>
                                )}
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
                                  {isEditingTag ? (
                                    <>
                                      <button
                                        type="button"
                                        className="rounded p-1 hover:bg-muted"
                                        onClick={() => saveEditTag(tag)}
                                      >
                                        <Check className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded p-1 hover:bg-muted"
                                        onClick={cancelEditTag}
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="rounded p-1 hover:bg-muted"
                                        onClick={() => startEditTag(tag)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded p-1 hover:bg-muted text-destructive"
                                        onClick={() => handleDeleteTag(tag)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
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
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              {!opportunity?.id ? (
                <div className="text-sm text-muted-foreground">
                  Guardá la oportunidad para comenzar a gestionar actividades.
                </div>
              ) : (
                <>
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="text-sm font-semibold text-muted-foreground">Mensajes</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium">Canal</label>
                        <Select
                          value={messageChannel}
                          onValueChange={(value) => setMessageChannel(value as "email" | "whatsapp")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Plantilla</label>
                        <Select
                          value={messageTemplateId || "__none__"}
                          onValueChange={(value) =>
                            setMessageTemplateId(value === "__none__" ? "" : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sin plantilla" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin plantilla</SelectItem>
                            {filteredTemplates.map((tpl: any) => (
                              <SelectItem key={tpl.id} value={tpl.id}>
                                {tpl.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Destinatario</label>
                      <Input
                        value={messageRecipient}
                        onChange={(e) => setMessageRecipient(e.target.value)}
                        placeholder={messageChannel === "email" ? "email@cliente.com" : "+54 9 11 1234-5678"}
                      />
                    </div>
                    {messageChannel === "email" && (
                      <div>
                        <label className="text-xs font-medium">Asunto</label>
                        <Input
                          value={messageSubject}
                          onChange={(e) => setMessageSubject(e.target.value)}
                          placeholder="Asunto del email"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium">Mensaje</label>
                      <Textarea
                        value={messageBody}
                        onChange={(e) => setMessageBody(e.target.value)}
                        rows={3}
                        placeholder="Escribí el mensaje..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => sendMessageMutation.mutate()}
                        disabled={sendMessageMutation.isPending}
                      >
                        Enviar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => createTemplateMutation.mutate()}
                        disabled={createTemplateMutation.isPending || !messageBody.trim()}
                      >
                        Guardar plantilla
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-muted-foreground">Logs de mensajes</div>
                    {messageLogs.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Sin mensajes enviados.</div>
                    ) : (
                      <div className="space-y-2">
                        {messageLogs.map((log: MessageLogDTO) => (
                          <div key={log.id} className="rounded border p-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {log.channel.toUpperCase()} • {log.recipient}
                              </span>
                              <Badge variant={log.status === "failed" ? "destructive" : "secondary"}>
                                {log.status}
                              </Badge>
                            </div>
                            {log.subject && <div className="text-muted-foreground">{log.subject}</div>}
                            <div className="text-muted-foreground line-clamp-2">{log.body}</div>
                            {log.error && <div className="text-destructive">{log.error}</div>}
                            <div className="text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filtrar por tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="call">Llamada</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="task">Tarea</SelectItem>
                        <SelectItem value="meeting">Reunión</SelectItem>
                        <SelectItem value="note">Nota</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium">Tipo</label>
                        <Select
                          value={activityForm.type}
                          onValueChange={(value) =>
                            setActivityForm((prev) => ({ ...prev, type: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call">Llamada</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="task">Tarea</SelectItem>
                            <SelectItem value="meeting">Reunión</SelectItem>
                            <SelectItem value="note">Nota</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium">Fecha</label>
                        <Input
                          type="date"
                          value={activityForm.due_at}
                          onChange={(e) =>
                            setActivityForm((prev) => ({ ...prev, due_at: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Asunto</label>
                      <Input
                        value={activityForm.subject}
                        onChange={(e) =>
                          setActivityForm((prev) => ({ ...prev, subject: e.target.value }))
                        }
                        placeholder="Ej: Llamar para demo"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Notas</label>
                      <Textarea
                        value={activityForm.notes}
                        onChange={(e) =>
                          setActivityForm((prev) => ({ ...prev, notes: e.target.value }))
                        }
                        rows={2}
                        placeholder="Detalles de la actividad..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (editingActivityId) {
                            updateActivityMutation.mutate();
                          } else {
                            createActivityMutation.mutate();
                          }
                        }}
                        disabled={
                          createActivityMutation.isPending || updateActivityMutation.isPending
                        }
                      >
                        {editingActivityId ? "Actualizar" : "Crear"}
                      </Button>
                      {editingActivityId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingActivityId(null);
                            setActivityForm({ type: "call", subject: "", notes: "", due_at: "" });
                          }}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(activityList?.data ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No hay actividades registradas.
                      </div>
                    ) : (
                      (activityList?.data ?? []).map((activity: ActivityDTO) => (
                        <div
                          key={activity.id}
                          className="border rounded-md p-3 flex items-start justify-between gap-2"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{activity.type}</Badge>
                              {activity.dueAt && (
                                <span className="text-xs text-muted-foreground">
                                  {activity.dueAt}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-medium">{activity.subject || "Sin asunto"}</div>
                            {activity.notes && (
                              <div className="text-xs text-muted-foreground">{activity.notes}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditingActivityId(activity.id);
                                setActivityForm({
                                  type: activity.type,
                                  subject: activity.subject || "",
                                  notes: activity.notes || "",
                                  due_at: activity.dueAt || "",
                                });
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => {
                                if (confirm("¿Eliminar esta actividad?")) {
                                  deleteActivityMutation.mutate(activity.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {!opportunity?.id ? (
                <div className="text-sm text-muted-foreground">
                  Guardá la oportunidad para ver el historial.
                </div>
              ) : (activityLogList?.data ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No hay historial registrado.
                </div>
              ) : (
                <div className="space-y-2">
                  {(activityLogList?.data ?? []).map((log) => (
                    <div key={log.id} className="border rounded-md p-3">
                      <div className="text-sm font-medium">{log.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()} · {log.createdBy || "Sistema"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

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
