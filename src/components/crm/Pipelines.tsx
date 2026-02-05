import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, GripVertical, Pencil, Trash2, MoreVertical } from "lucide-react";
import { OpportunityDrawer } from "./OpportunityDrawer";
import type { Database } from "@/integrations/supabase/types";

type OpportunityRow = Database["public"]["Tables"]["crm_opportunities"]["Row"];

interface Pipeline {
  id: string;
  name: string;
  stages: string[];
  company_id: string;
  created_at: string;
}

interface Opportunity {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  customer_id: string | null;
  probability: number | null;
  customers?: { name: string } | null;
}

export function Pipelines({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStages, setNewStages] = useState([
    "Nuevo",
    "Contactado",
    "Propuesta",
    "Negociación",
    "Ganado",
    "Perdido",
  ]);
  const [draggedOpportunity, setDraggedOpportunity] = useState<Opportunity | null>(null);
  const [quickCreateStage, setQuickCreateStage] = useState<string | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState<string | null>(null);
  const [editingOpportunity, setEditingOpportunity] = useState<OpportunityRow | null>(null);

  // Fetch pipelines
  const { data: pipelines, isLoading: pipelinesLoading } = useQuery<Pipeline[]>({
    queryKey: ["crm-pipelines", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pipeline[];
    },
    enabled: !!companyId,
  });

  // Auto-select first pipeline
  const selectedPipeline = useMemo(() => {
    if (!pipelines?.length) return null;
    if (selectedPipelineId) {
      return pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];
    }
    return pipelines[0];
  }, [pipelines, selectedPipelineId]);

  // Fetch opportunities for selected pipeline
  const { data: opportunities = [] } = useQuery<Opportunity[]>({
    queryKey: ["crm-opportunities-pipeline", companyId, selectedPipeline?.id],
    queryFn: async () => {
      if (!selectedPipeline) return [];
      const { data, error } = await supabase
        .from("crm_opportunities")
        .select("id, name, value, stage, customer_id, probability, customers(name)")
        .eq("company_id", companyId)
        .eq("pipeline_id", selectedPipeline.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Opportunity[];
    },
    enabled: !!companyId && !!selectedPipeline,
  });

  // Create pipeline mutation
  const createPipelineMutation = useMutation({
    mutationFn: async () => {
      if (!newPipelineName.trim()) throw new Error("El nombre es requerido");
      const { error } = await supabase.from("crm_pipelines").insert([
        {
          company_id: companyId,
          name: newPipelineName.trim(),
          stages: newStages.filter((s) => s.trim()),
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-pipelines", companyId] });
      toast.success("Pipeline creado exitosamente");
      setIsCreateDialogOpen(false);
      setNewPipelineName("");
      setNewStages(["Nuevo", "Contactado", "Propuesta", "Negociación", "Ganado", "Perdido"]);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear pipeline");
    },
  });

  // Update opportunity stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ opportunityId, newStage }: { opportunityId: string; newStage: string }) => {
      const { error } = await supabase
        .from("crm_opportunities")
        .update({ stage: newStage })
        .eq("id", opportunityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      toast.success("Etapa actualizada");
    },
    onError: () => {
      toast.error("Error al actualizar etapa");
    },
  });

  // Delete pipeline mutation
  const deletePipelineMutation = useMutation({
    mutationFn: async (pipelineId: string) => {
      const { error } = await supabase.from("crm_pipelines").delete().eq("id", pipelineId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-pipelines", companyId] });
      toast.success("Pipeline eliminado");
      setSelectedPipelineId(null);
    },
    onError: () => {
      toast.error("Error al eliminar pipeline");
    },
  });

  // Quick create opportunity mutation
  const quickCreateMutation = useMutation({
    mutationFn: async ({ name, stage }: { name: string; stage: string }) => {
      if (!selectedPipeline) throw new Error("Pipeline no seleccionado");
      const { error } = await supabase.from("crm_opportunities").insert([
        {
          company_id: companyId,
          name: name.trim(),
          stage,
          pipeline_id: selectedPipeline.id,
          customer_id: null,
          probability: 50,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      toast.success("Oportunidad creada");
      setQuickCreateOpen(false);
      setQuickCreateStage(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear oportunidad");
    },
  });

  // Assign existing opportunity to pipeline
  const assignOpportunityMutation = useMutation({
    mutationFn: async ({ opportunityId, stage }: { opportunityId: string; stage: string }) => {
      if (!selectedPipeline) throw new Error("Pipeline no seleccionado");
      const { error } = await supabase
        .from("crm_opportunities")
        .update({ pipeline_id: selectedPipeline.id, stage })
        .eq("id", opportunityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      toast.success("Oportunidad asignada");
      setAddExistingOpen(null);
    },
    onError: () => {
      toast.error("Error al asignar oportunidad");
    },
  });

  // Fetch unassigned opportunities
  const { data: unassignedOpportunities = [] } = useQuery<Opportunity[]>({
    queryKey: ["crm-opportunities-unassigned", companyId, selectedPipeline?.id],
    queryFn: async () => {
      if (!selectedPipeline) return [];
      const { data, error } = await supabase
        .from("crm_opportunities")
        .select("id, name, value, stage, customer_id, probability, customers(name)")
        .eq("company_id", companyId)
        .neq("pipeline_id", selectedPipeline.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Opportunity[];
    },
    enabled: !!companyId && !!selectedPipeline,
  });

  // Delete opportunity mutation
  const deleteOpportunityMutation = useMutation({
    mutationFn: async (opportunityId: string) => {
      const { error } = await supabase
        .from("crm_opportunities")
        .delete()
        .eq("id", opportunityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", companyId] });
      toast.success("Oportunidad eliminada");
    },
    onError: () => {
      toast.error("Error al eliminar oportunidad");
    },
  });

  const handleDeleteOpportunity = (opportunityId: string, opportunityName: string) => {
    if (confirm(`¿Eliminar la oportunidad "${opportunityName}"?`)) {
      deleteOpportunityMutation.mutate(opportunityId);
    }
  };

  const handleEditOpportunity = async (oppId: string) => {
    // Fetch full opportunity data
    const { data, error } = await supabase
      .from("crm_opportunities")
      .select("*")
      .eq("id", oppId)
      .single();
    
    if (error) {
      toast.error("Error al cargar oportunidad");
      return;
    }
    
    setEditingOpportunity(data as OpportunityRow);
  };

  const handleDragStart = (opportunity: Opportunity) => {
    setDraggedOpportunity(opportunity);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (stage: string) => {
    if (!draggedOpportunity) return;
    if (draggedOpportunity.stage === stage) {
      setDraggedOpportunity(null);
      return;
    }
    updateStageMutation.mutate({
      opportunityId: draggedOpportunity.id,
      newStage: stage,
    });
    setDraggedOpportunity(null);
  };

  const addStage = () => {
    setNewStages([...newStages, ""]);
  };

  const removeStage = (index: number) => {
    setNewStages(newStages.filter((_, i) => i !== index));
  };

  const updateStage = (index: number, value: string) => {
    const updated = [...newStages];
    updated[index] = value;
    setNewStages(updated);
  };

  const opportunitiesByStage = useMemo(() => {
    const grouped: Record<string, Opportunity[]> = {};
    selectedPipeline?.stages.forEach((stage) => {
      grouped[stage] = [];
    });
    opportunities.forEach((opp) => {
      if (grouped[opp.stage]) {
        grouped[opp.stage].push(opp);
      }
    });
    return grouped;
  }, [opportunities, selectedPipeline]);

  if (pipelinesLoading) {
    return <div className="p-6">Cargando pipelines...</div>;
  }

  if (!pipelines?.length) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Pipelines</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No hay pipelines creados.</p>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear primer pipeline
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Pipeline</DialogTitle>
                </DialogHeader>
                <CreatePipelineForm
                  newPipelineName={newPipelineName}
                  setNewPipelineName={setNewPipelineName}
                  newStages={newStages}
                  updateStage={updateStage}
                  removeStage={removeStage}
                  addStage={addStage}
                  onSubmit={() => createPipelineMutation.mutate()}
                  isPending={createPipelineMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pipelines</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Pipeline</DialogTitle>
            </DialogHeader>
            <CreatePipelineForm
              newPipelineName={newPipelineName}
              setNewPipelineName={setNewPipelineName}
              newStages={newStages}
              updateStage={updateStage}
              removeStage={removeStage}
              addStage={addStage}
              onSubmit={() => createPipelineMutation.mutate()}
              isPending={createPipelineMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <Select
          value={selectedPipeline?.id || ""}
          onValueChange={(value) => setSelectedPipelineId(value)}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Seleccionar pipeline" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedPipeline && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("¿Eliminar este pipeline? Esta acción no se puede deshacer.")) {
                deletePipelineMutation.mutate(selectedPipeline.id);
              }
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar
          </Button>
        )}
      </div>

      {selectedPipeline && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {selectedPipeline.stages.map((stage) => (
              <div
                key={stage}
                className="flex-shrink-0 w-80"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage)}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>{stage}</span>
                      <Badge variant="secondary">{opportunitiesByStage[stage]?.length || 0}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 min-h-[200px]">
                    {opportunitiesByStage[stage]?.map((opp) => (
                      <div
                        key={opp.id}
                        draggable
                        onDragStart={() => handleDragStart(opp)}
                        onClick={() => handleEditOpportunity(opp.id)}
                        className="p-3 bg-white border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start gap-2 flex-1">
                            <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{opp.name}</p>
                              {opp.customers?.name && (
                                <p className="text-xs text-muted-foreground">{opp.customers.name}</p>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditOpportunity(opp.id);
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOpportunity(opp.id, opp.name);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          {opp.value && <span className="font-mono">${opp.value}</span>}
                          {opp.probability !== null && (
                            <Badge variant="outline" className="text-xs">
                              {opp.probability}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Dialog open={quickCreateStage === stage && quickCreateOpen} onOpenChange={(open) => {
                        if (!open) {
                          setQuickCreateStage(null);
                          setQuickCreateOpen(false);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => {
                              setQuickCreateStage(stage);
                              setQuickCreateOpen(true);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Crear
                          </Button>
                        </DialogTrigger>
                        {quickCreateStage === stage && (
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Crear Oportunidad - {stage}</DialogTitle>
                            </DialogHeader>
                            <QuickCreateOpportunityForm
                              stage={stage}
                              onSubmit={(name) => {
                                quickCreateMutation.mutate({ name, stage });
                              }}
                              isPending={quickCreateMutation.isPending}
                            />
                          </DialogContent>
                        )}
                      </Dialog>
                      <Dialog open={addExistingOpen === stage} onOpenChange={(open) => {
                        if (!open) setAddExistingOpen(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => setAddExistingOpen(stage)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Agregar
                          </Button>
                        </DialogTrigger>
                        {addExistingOpen === stage && (
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Agregar Oportunidad - {stage}</DialogTitle>
                            </DialogHeader>
                            <AddExistingOpportunityForm
                              stage={stage}
                              unassignedOpportunities={unassignedOpportunities}
                              onSubmit={(opportunityId) => {
                                assignOpportunityMutation.mutate({
                                  opportunityId,
                                  stage,
                                });
                              }}
                              isPending={assignOpportunityMutation.isPending}
                            />
                          </DialogContent>
                        )}
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      <OpportunityDrawer
        open={!!editingOpportunity}
        onClose={() => setEditingOpportunity(null)}
        companyId={companyId}
        opportunity={editingOpportunity}
      />
    </div>
  );
}

function CreatePipelineForm({
  newPipelineName,
  setNewPipelineName,
  newStages,
  updateStage,
  removeStage,
  addStage,
  onSubmit,
  isPending,
}: {
  newPipelineName: string;
  setNewPipelineName: (name: string) => void;
  newStages: string[];
  updateStage: (index: number, value: string) => void;
  removeStage: (index: number) => void;
  addStage: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Nombre del Pipeline *</label>
        <Input
          value={newPipelineName}
          onChange={(e) => setNewPipelineName(e.target.value)}
          placeholder="Ej: Ventas B2B"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Etapas</label>
        <p className="text-xs text-muted-foreground">
          Define las etapas del pipeline. Podés editar, eliminar o agregar más.
        </p>
        <div className="space-y-2">
          {newStages.map((stage, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={stage}
                onChange={(e) => updateStage(index, e.target.value)}
                placeholder={`Etapa ${index + 1}`}
              />
              {newStages.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeStage(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" onClick={addStage} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Agregar etapa
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          Crear Pipeline
        </Button>
      </div>
    </form>
  );
}

function QuickCreateOpportunityForm({
  stage,
  onSubmit,
  isPending,
}: {
  stage: string;
  onSubmit: (name: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) {
          onSubmit(name);
          setName("");
        }
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Nombre de la Oportunidad *</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Venta importante"
          required
          autoFocus
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending || !name.trim()}>
          Crear Oportunidad
        </Button>
      </div>
    </form>
  );
}

function AddExistingOpportunityForm({
  stage,
  unassignedOpportunities,
  onSubmit,
  isPending,
}: {
  stage: string;
  unassignedOpportunities: Opportunity[];
  onSubmit: (opportunityId: string) => void;
  isPending: boolean;
}) {
  const [selectedId, setSelectedId] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (selectedId) {
          onSubmit(selectedId);
          setSelectedId("");
        }
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Seleccionar Oportunidad *</label>
        {unassignedOpportunities.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay oportunidades disponibles.</p>
        ) : (
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Elegir oportunidad..." />
            </SelectTrigger>
            <SelectContent>
              {unassignedOpportunities.map((opp) => (
                <SelectItem key={opp.id} value={opp.id}>
                  {opp.name} {opp.customers?.name && `(${opp.customers.name})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending || !selectedId}>
          Agregar Oportunidad
        </Button>
      </div>
    </form>
  );
}
