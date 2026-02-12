import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ScoringRuleDTO } from "@/domain/crm/dtos/scoringRule";
import { scoringRuleService } from "@/domain/crm/services/scoringRuleService";

const FIELD_OPTIONS = [
  { value: "value", label: "Monto" },
  { value: "probability", label: "Probabilidad" },
  { value: "stage", label: "Etapa" },
  { value: "status", label: "Estado" },
  { value: "source", label: "Fuente" },
  { value: "tags", label: "Tags" },
];

const NUMERIC_OPERATORS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
];

const TEXT_OPERATORS = [
  { value: "eq", label: "Igual" },
  { value: "neq", label: "Distinto" },
  { value: "contains", label: "Contiene" },
];

const isNumericField = (field?: string) => field === "value" || field === "probability";

export function ScoringRules({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [field, setField] = useState("value");
  const [operator, setOperator] = useState("eq");
  const [value, setValue] = useState("");
  const [points, setPoints] = useState("10");
  const [active, setActive] = useState(true);
  const [editingRule, setEditingRule] = useState<ScoringRuleDTO | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const operatorOptions = useMemo(
    () => (isNumericField(field) ? NUMERIC_OPERATORS : TEXT_OPERATORS),
    [field]
  );

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["crm-scoring-rules", companyId],
    queryFn: () => scoringRuleService.list(companyId),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const recalcMutation = useMutation({
    mutationFn: () => scoringRuleService.recalculateCompany(companyId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["opportunities", companyId] });
      queryClient.invalidateQueries({ queryKey: ["crm-opportunities-pipeline"] });
      toast.success(
        `Scores recalculados: ${result.updated} de ${result.total} oportunidades.`
      );
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al recalcular scores");
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      scoringRuleService.create({
        company_id: companyId,
        name: name.trim(),
        field,
        operator,
        value: value.trim(),
        points: Number(points),
        active,
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["crm-scoring-rules", companyId] });
      await recalcMutation.mutateAsync();
      setName("");
      setValue("");
      setPoints("10");
      setActive(true);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear regla");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; updates: Partial<ScoringRuleDTO> }) =>
      scoringRuleService.update(payload.id, payload.updates as any),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["crm-scoring-rules", companyId] });
      await recalcMutation.mutateAsync();
      setEditOpen(false);
      setEditingRule(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar regla");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scoringRuleService.remove(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["crm-scoring-rules", companyId] });
      await recalcMutation.mutateAsync();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar regla");
    },
  });

  const handleStartEdit = (rule: ScoringRuleDTO) => {
    setEditingRule(rule);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingRule) return;
    updateMutation.mutate({
      id: editingRule.id,
      updates: {
        name: editingRule.name.trim(),
        field: editingRule.field,
        operator: editingRule.operator,
        value: editingRule.value.trim(),
        points: editingRule.points,
        active: editingRule.active,
      },
    });
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Scoring de oportunidades</CardTitle>
          <p className="text-xs text-muted-foreground">
            Configurá reglas para calcular el score automáticamente.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => recalcMutation.mutate()}
          disabled={recalcMutation.isPending}
        >
          Recalcular scores
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_0.7fr_0.6fr_auto]">
          <Input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            value={field}
            onValueChange={(value) => {
              setField(value);
              setOperator("eq");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Campo" />
            </SelectTrigger>
            <SelectContent>
              {FIELD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={operator}
            onValueChange={setOperator}
          >
            <SelectTrigger>
              <SelectValue placeholder="Operador" />
            </SelectTrigger>
            <SelectContent>
              {operatorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Valor"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Puntos"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <span className="text-xs">Activa</span>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || !value.trim() || createMutation.isPending}
          >
            Crear
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.6fr_0.5fr_auto] gap-2 px-3 py-2 text-xs font-semibold bg-muted">
            <span>Nombre</span>
            <span>Campo</span>
            <span>Operador</span>
            <span>Valor</span>
            <span>Puntos</span>
            <span>Estado</span>
            <span></span>
          </div>
          {isLoading ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">Cargando reglas...</div>
          ) : !rules.length ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">
              Todavía no hay reglas configuradas.
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.6fr_0.5fr_auto] gap-2 px-3 py-2 text-sm border-t"
              >
                <span className="truncate">{rule.name}</span>
                <span>{FIELD_OPTIONS.find((o) => o.value === rule.field)?.label ?? rule.field}</span>
                <span>{rule.operator}</span>
                <span className="truncate">{rule.value}</span>
                <span>{rule.points}</span>
                <Badge variant={rule.active ? "default" : "secondary"}>
                  {rule.active ? "Activa" : "Inactiva"}
                </Badge>
                <div className="flex items-center gap-2 justify-end">
                  <Dialog
                    open={editOpen && editingRule?.id === rule.id}
                    onOpenChange={(open) => {
                      setEditOpen(open);
                      if (!open) setEditingRule(null);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartEdit(rule)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar regla</DialogTitle>
                      </DialogHeader>
                      {editingRule && (
                        <div className="space-y-3">
                          <Input
                            placeholder="Nombre"
                            value={editingRule.name}
                            onChange={(e) =>
                              setEditingRule({
                                ...editingRule,
                                name: e.target.value,
                              })
                            }
                          />
                          <Select
                            value={editingRule.field}
                            onValueChange={(value) =>
                              setEditingRule({
                                ...editingRule,
                                field: value,
                                operator: isNumericField(value) ? "eq" : "eq",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Campo" />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={editingRule.operator}
                            onValueChange={(value) =>
                              setEditingRule({
                                ...editingRule,
                                operator: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Operador" />
                            </SelectTrigger>
                            <SelectContent>
                              {(isNumericField(editingRule.field)
                                ? NUMERIC_OPERATORS
                                : TEXT_OPERATORS
                              ).map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Valor"
                            value={editingRule.value}
                            onChange={(e) =>
                              setEditingRule({
                                ...editingRule,
                                value: e.target.value,
                              })
                            }
                          />
                          <Input
                            type="number"
                            placeholder="Puntos"
                            value={editingRule.points}
                            onChange={(e) =>
                              setEditingRule({
                                ...editingRule,
                                points: Number(e.target.value),
                              })
                            }
                          />
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingRule.active}
                              onCheckedChange={(checked) =>
                                setEditingRule({
                                  ...editingRule,
                                  active: checked,
                                })
                              }
                            />
                            <span className="text-xs">Activa</span>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setEditOpen(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                              Guardar
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("¿Eliminar esta regla?")) {
                        deleteMutation.mutate(rule.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
