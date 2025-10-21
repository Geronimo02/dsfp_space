import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Edit, Trash2, Tag, TrendingDown, Gift, Percent } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export default function Promotions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any>(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    type: "percentage",
    value: "0",
    min_quantity: "1",
    min_amount: "0",
    max_uses: "",
    start_date: "",
    end_date: "",
    active: true,
    applies_to: "all",
    category: "",
  });

  const { data: promotions } = useQuery({
    queryKey: ["promotions", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`code.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("promotions").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promoción creada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("promotions").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promoción actualizada");
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promoción eliminada");
      queryClient.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      value: parseFloat(formData.value),
      min_quantity: parseInt(formData.min_quantity),
      min_amount: parseFloat(formData.min_amount),
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
    };

    if (editingPromotion) {
      updateMutation.mutate({ id: editingPromotion.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (promotion: any) => {
    setEditingPromotion(promotion);
    setFormData({
      code: promotion.code,
      name: promotion.name,
      description: promotion.description || "",
      type: promotion.type,
      value: promotion.value.toString(),
      min_quantity: promotion.min_quantity.toString(),
      min_amount: promotion.min_amount.toString(),
      max_uses: promotion.max_uses?.toString() || "",
      start_date: promotion.start_date.split("T")[0],
      end_date: promotion.end_date ? promotion.end_date.split("T")[0] : "",
      active: promotion.active,
      applies_to: promotion.applies_to,
      category: promotion.category || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPromotion(null);
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "percentage",
      value: "0",
      min_quantity: "1",
      min_amount: "0",
      max_uses: "",
      start_date: "",
      end_date: "",
      active: true,
      applies_to: "all",
      category: "",
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "percentage": return <Percent className="h-4 w-4" />;
      case "fixed": return <TrendingDown className="h-4 w-4" />;
      case "volume": return <Gift className="h-4 w-4" />;
      default: return <Tag className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "percentage": return "Porcentaje";
      case "fixed": return "Fijo";
      case "volume": return "Por Volumen";
      default: return type;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Promociones y Descuentos</h1>
            <p className="text-muted-foreground">Gestión de cupones y ofertas</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Promoción
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPromotion ? "Editar Promoción" : "Nueva Promoción"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="VERANO2024"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Oferta de Verano"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción de la promoción..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Descuento *</Label>
                    <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentaje</SelectItem>
                        <SelectItem value="fixed">Monto Fijo</SelectItem>
                        <SelectItem value="volume">Por Volumen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor *</Label>
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_quantity">Cantidad Mínima</Label>
                    <Input
                      id="min_quantity"
                      type="number"
                      value={formData.min_quantity}
                      onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_amount">Monto Mínimo</Label>
                    <Input
                      id="min_amount"
                      type="number"
                      step="0.01"
                      value={formData.min_amount}
                      onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Fecha Inicio *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">Fecha Fin</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_uses">Máximo de Usos</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                    placeholder="Dejar vacío para ilimitado"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label htmlFor="active">Promoción Activa</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingPromotion ? "Actualizar" : "Crear"} Promoción
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Válido Hasta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions?.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-mono font-bold">{promo.code}</TableCell>
                    <TableCell>{promo.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {getTypeIcon(promo.type)}
                        {getTypeLabel(promo.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {promo.type === "percentage" ? `${promo.value}%` : `$${promo.value}`}
                    </TableCell>
                    <TableCell>
                      {promo.current_uses}/{promo.max_uses || "∞"}
                    </TableCell>
                    <TableCell>
                      {promo.end_date 
                        ? format(new Date(promo.end_date), "dd/MM/yyyy", { locale: es })
                        : "Sin límite"
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant={promo.active ? "default" : "secondary"}>
                        {promo.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="icon" variant="outline" onClick={() => handleEdit(promo)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          if (confirm("¿Eliminar esta promoción?")) {
                            deleteMutation.mutate(promo.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
