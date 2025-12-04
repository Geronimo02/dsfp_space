import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Edit, Trash2, Plus, Tag, Calendar } from "lucide-react";

interface CustomPricingManagerProps {
  companyId: string;
  companyName: string;
}

export function CustomPricingManager({ companyId, companyName }: CustomPricingManagerProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<any>(null);
  const [formData, setFormData] = useState({
    module_id: "",
    custom_price_monthly: "",
    custom_price_annual: "",
    discount_percentage: "",
    reason: "",
    notes: "",
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: "",
  });

  // Fetch all modules
  const { data: allModules } = useQuery({
    queryKey: ['platform_modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_modules')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch custom pricing for this company
  const { data: customPricing, isLoading } = useQuery({
    queryKey: ['custom_pricing', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('company_custom_pricing')
        .select(`
          *,
          module:platform_modules(id, name, code, price_monthly, price_annual)
        `)
        .eq('company_id', companyId);
      
      if (error) throw error;
      return data;
    }
  });

  // Save custom pricing mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        company_id: companyId,
        module_id: data.module_id,
        custom_price_monthly: data.custom_price_monthly ? parseFloat(data.custom_price_monthly) : null,
        custom_price_annual: data.custom_price_annual ? parseFloat(data.custom_price_annual) : null,
        discount_percentage: data.discount_percentage ? parseFloat(data.discount_percentage) : 0,
        reason: data.reason,
        notes: data.notes,
        valid_from: data.valid_from || null,
        valid_until: data.valid_until || null,
      };

      if (editingPricing) {
        const { error } = await (supabase as any)
          .from('company_custom_pricing')
          .update(payload)
          .eq('id', editingPricing.id);
        
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('company_custom_pricing')
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_pricing', companyId] });
      toast.success(editingPricing ? 'Precio actualizado' : 'Precio personalizado creado');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al guardar precio');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('company_custom_pricing')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_pricing', companyId] });
      toast.success('Precio personalizado eliminado');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al eliminar precio');
    }
  });

  const handleOpenDialog = (pricing?: any) => {
    if (pricing) {
      setEditingPricing(pricing);
      setFormData({
        module_id: pricing.module_id,
        custom_price_monthly: pricing.custom_price_monthly || "",
        custom_price_annual: pricing.custom_price_annual || "",
        discount_percentage: pricing.discount_percentage || "",
        reason: pricing.reason || "",
        notes: pricing.notes || "",
        valid_from: pricing.valid_from?.split('T')[0] || "",
        valid_until: pricing.valid_until?.split('T')[0] || "",
      });
    } else {
      setEditingPricing(null);
      setFormData({
        module_id: "",
        custom_price_monthly: "",
        custom_price_annual: "",
        discount_percentage: "",
        reason: "",
        notes: "",
        valid_from: new Date().toISOString().split('T')[0],
        valid_until: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPricing(null);
  };

  const handleSave = () => {
    if (!formData.module_id) {
      toast.error('Selecciona un módulo');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Eliminar este precio personalizado?')) {
      deleteMutation.mutate(id);
    }
  };

  const getStandardPrice = (moduleId: string, cycle: 'monthly' | 'annual') => {
    const module = allModules?.find(m => m.id === moduleId);
    if (!module) return 0;
    return cycle === 'annual' ? module.price_annual : module.price_monthly;
  };

  const calculateSavings = (pricing: any) => {
    const module = allModules?.find(m => m.id === pricing.module_id);
    if (!module) return { monthly: 0, annual: 0 };

    const standardMonthly = module.price_monthly;
    const standardAnnual = module.price_annual;
    const customMonthly = pricing.custom_price_monthly || standardMonthly;
    const customAnnual = pricing.custom_price_annual || standardAnnual;

    return {
      monthly: standardMonthly - customMonthly,
      annual: standardAnnual - customAnnual,
    };
  };

  if (isLoading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Precios Personalizados - {companyName}
              </CardTitle>
              <CardDescription>
                Configura precios especiales para módulos específicos de esta empresa
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Precio
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!customPricing || customPricing.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay precios personalizados configurados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Precio Mensual</TableHead>
                  <TableHead>Precio Anual</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead>Ahorro</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customPricing.map((pricing: any) => {
                  const savings = calculateSavings(pricing);
                  const standardMonthly = getStandardPrice(pricing.module_id, 'monthly');
                  const standardAnnual = getStandardPrice(pricing.module_id, 'annual');
                  
                  return (
                    <TableRow key={pricing.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{pricing.module.name}</div>
                          <div className="text-xs text-muted-foreground">{pricing.module.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold text-green-600">
                            ${pricing.custom_price_monthly || standardMonthly}
                          </div>
                          {pricing.custom_price_monthly && (
                            <div className="text-xs text-muted-foreground line-through">
                              ${standardMonthly}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="font-semibold text-green-600">
                            ${pricing.custom_price_annual || standardAnnual}
                          </div>
                          {pricing.custom_price_annual && (
                            <div className="text-xs text-muted-foreground line-through">
                              ${standardAnnual}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {pricing.discount_percentage > 0 && (
                          <Badge variant="secondary">
                            <Tag className="h-3 w-3 mr-1" />
                            {pricing.discount_percentage}%
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {(savings.monthly > 0 || savings.annual > 0) && (
                          <div className="text-xs">
                            {savings.monthly > 0 && <div className="text-green-600">-${savings.monthly}/mes</div>}
                            {savings.annual > 0 && <div className="text-green-600">-${savings.annual}/año</div>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3" />
                          {pricing.valid_until ? (
                            <span>Hasta {new Date(pricing.valid_until).toLocaleDateString()}</span>
                          ) : (
                            <span>Sin límite</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(pricing)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(pricing.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog for create/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPricing ? 'Editar' : 'Nuevo'} Precio Personalizado
            </DialogTitle>
            <DialogDescription>
              Configura un precio especial para un módulo específico
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Módulo</Label>
              <Select
                value={formData.module_id}
                onValueChange={(value) => setFormData({ ...formData, module_id: value })}
                disabled={!!editingPricing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un módulo" />
                </SelectTrigger>
                <SelectContent>
                  {allModules?.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.name} (Mensual: ${module.price_monthly} / Anual: ${module.price_annual})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Precio Mensual Personalizado</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Dejar vacío para usar estándar"
                  value={formData.custom_price_monthly}
                  onChange={(e) => setFormData({ ...formData, custom_price_monthly: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Precio Anual Personalizado</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Dejar vacío para usar estándar"
                  value={formData.custom_price_annual}
                  onChange={(e) => setFormData({ ...formData, custom_price_annual: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Descuento Adicional (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Razón del Precio Especial</Label>
              <Input
                placeholder="Ej: Cliente VIP, Promoción lanzamiento, etc."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Notas Internas</Label>
              <Textarea
                placeholder="Notas adicionales sobre este precio personalizado"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Válido Desde</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Válido Hasta (Opcional)</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
