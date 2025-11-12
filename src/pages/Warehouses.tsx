import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, Package, ArrowLeftRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";

interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  manager_name?: string;
  is_main: boolean;
  active: boolean;
}

export default function Warehouses() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    manager_name: "",
    is_main: false,
    active: true,
  });

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["warehouses", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("is_main", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Warehouse[];
    },
  });

  const createWarehouse = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("warehouses").insert([{
        ...data,
        company_id: currentCompany?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Depósito creado exitosamente");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateWarehouse = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("warehouses").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Depósito actualizado exitosamente");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteWarehouse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Depósito eliminado exitosamente");
      setDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      address: "",
      phone: "",
      manager_name: "",
      is_main: false,
      active: true,
    });
    setSelectedWarehouse(null);
  };

  const handleEdit = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address || "",
      phone: warehouse.phone || "",
      manager_name: warehouse.manager_name || "",
      is_main: warehouse.is_main,
      active: warehouse.active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.code) {
      toast.error("Nombre y código son requeridos");
      return;
    }

    if (selectedWarehouse) {
      updateWarehouse.mutate({ id: selectedWarehouse.id, data: formData });
    } else {
      createWarehouse.mutate(formData);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Depósitos</h1>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/warehouse-transfers")}
              variant="outline"
              className="hover:scale-105 transition-transform"
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Transferencias
            </Button>
            <Button
              onClick={() => navigate("/warehouse-stock")}
              variant="outline"
              className="hover:scale-105 transition-transform"
            >
              <Package className="mr-2 h-4 w-4" />
              Stock por Depósito
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="hover:scale-105 transition-transform">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Depósito
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md animate-scale-in">
                <DialogHeader>
                  <DialogTitle>
                    {selectedWarehouse ? "Editar Depósito" : "Nuevo Depósito"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nombre *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Depósito Central"
                    />
                  </div>
                  <div>
                    <Label>Código *</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="DEP-01"
                      disabled={!!selectedWarehouse}
                    />
                  </div>
                  <div>
                    <Label>Dirección</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Calle 123"
                    />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+54 11 1234-5678"
                    />
                  </div>
                  <div>
                    <Label>Encargado</Label>
                    <Input
                      value={formData.manager_name}
                      onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Depósito Principal</Label>
                    <Switch
                      checked={formData.is_main}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_main: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Activo</Label>
                    <Switch
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSubmit}>
                      {selectedWarehouse ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="p-6">
          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Encargado</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses?.map((warehouse, index) => (
                  <TableRow key={warehouse.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm">{warehouse.code}</code>
                        {warehouse.is_main && (
                          <Badge variant="default" className="animate-pulse-subtle">Principal</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>{warehouse.address || "-"}</TableCell>
                    <TableCell>{warehouse.manager_name || "-"}</TableCell>
                    <TableCell>{warehouse.phone || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={warehouse.active ? "default" : "secondary"}>
                        {warehouse.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(warehouse)}
                          className="hover:scale-110 transition-transform"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!warehouse.is_main && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedWarehouse(warehouse);
                              setDeleteDialogOpen(true);
                            }}
                            className="hover:scale-110 transition-transform"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar depósito?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el depósito y todo su stock asociado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedWarehouse && deleteWarehouse.mutate(selectedWarehouse.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
