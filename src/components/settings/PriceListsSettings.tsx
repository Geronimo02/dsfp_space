import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";

interface PriceList {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export function PriceListsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentCompany, loading: companyLoading } = useCompany();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [deletingPriceList, setDeletingPriceList] = useState<PriceList | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Fetch price lists
  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ["price_lists", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("price_lists")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("is_default", { ascending: false })
        .order("name");
      
      if (error) throw error;
      return data as PriceList[];
    },
    enabled: !!currentCompany?.id,
  });

  // Reset form
  const resetForm = () => {
    setName("");
    setDescription("");
    setIsDefault(false);
    setIsActive(true);
    setEditingPriceList(null);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error("No company selected");
      
      const { error } = await supabase.from("price_lists").insert({
        company_id: currentCompany.id,
        name: name.trim(),
        description: description.trim() || null,
        is_default: isDefault,
        is_active: isActive,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Lista de precios creada",
        description: "La lista de precios ha sido creada exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["price_lists"] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("price_lists")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          is_default: isDefault,
          is_active: isActive,
        })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Lista de precios actualizada",
        description: "Los cambios han sido guardados exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["price_lists"] });
      setEditingPriceList(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("price_lists")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Lista de precios eliminada",
        description: "La lista de precios ha sido eliminada exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["price_lists"] });
      setDeletingPriceList(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (priceList: PriceList) => {
    setEditingPriceList(priceList);
    setName(priceList.name);
    setDescription(priceList.description || "");
    setIsDefault(priceList.is_default);
    setIsActive(priceList.is_active);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre es requerido",
        variant: "destructive",
      });
      return;
    }

    if (editingPriceList) {
      updateMutation.mutate(editingPriceList.id);
    } else {
      createMutation.mutate();
    }
  };

  if (companyLoading || !currentCompany) {
    return <div>Cargando información de la empresa...</div>;
  }

  if (isLoading) {
    return <div>Cargando listas de precios...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Listas de Precios</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona diferentes listas de precios para tus productos (minorista, mayorista, VIP, etc.)
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Lista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Crear Lista de Precios</DialogTitle>
                <DialogDescription>
                  Define una nueva lista de precios para tus productos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Lista Mayorista"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descripción opcional"
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_default">Lista por defecto</Label>
                  <Switch
                    id="is_default"
                    checked={isDefault}
                    onCheckedChange={setIsDefault}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_active">Activa</Label>
                  <Switch
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creando..." : "Crear Lista"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {priceLists.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No hay listas de precios</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crea tu primera lista de precios para comenzar
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priceLists.map((priceList) => (
                <TableRow key={priceList.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {priceList.name}
                      {priceList.is_default && (
                        <Badge variant="secondary">Por defecto</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {priceList.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={priceList.is_active ? "default" : "secondary"}>
                      {priceList.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(priceList)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingPriceList(priceList)}
                        disabled={priceList.is_default}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingPriceList} onOpenChange={(open) => {
        if (!open) {
          setEditingPriceList(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Editar Lista de Precios</DialogTitle>
              <DialogDescription>
                Modifica los datos de la lista de precios
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre *</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-is_default">Lista por defecto</Label>
                <Switch
                  id="edit-is_default"
                  checked={isDefault}
                  onCheckedChange={setIsDefault}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-is_active">Activa</Label>
                <Switch
                  id="edit-is_active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingPriceList(null);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingPriceList}
        onOpenChange={(open) => !open && setDeletingPriceList(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista de precios?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la lista "{deletingPriceList?.name}" y todos los precios asociados.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPriceList && deleteMutation.mutate(deletingPriceList.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
