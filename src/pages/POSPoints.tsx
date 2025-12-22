import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Receipt, Plus, Edit, Trash2, AlertCircle, CheckCircle2, FileText, Settings, Eye, Download, Loader2, Clock, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface POSAfip {
  id: string;
  punto_venta: number;
  descripcion: string;
  tipo_comprobante: string;
  ultimo_numero: number;
  prefijo: string | null;
  ubicacion: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function POSPoints() {
  const { currentCompany } = useCompany();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPOS, setSelectedPOS] = useState<POSAfip | null>(null);
  
  const [formData, setFormData] = useState({
    punto_venta: "",
    descripcion: "",
    tipo_comprobante: "FACTURA_B",
    prefijo: "",
    ubicacion: "",
    active: true,
  });

  const canView = hasPermission("pos_afip", "view");
  const canCreate = hasPermission("pos_afip", "create");
  const canEdit = hasPermission("pos_afip", "edit");
  const canDelete = hasPermission("pos_afip", "delete");

  // Fetch POS AFIP
  const { data: posPoints = [], isLoading } = useQuery({
    queryKey: ["pos-afip", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from("pos_afip")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("punto_venta", { ascending: true });

      if (error) throw error;
      return data as POSAfip[];
    },
    enabled: !!currentCompany?.id && canView,
  });

  // Create/Update POS
  const savePOSMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!currentCompany?.id) throw new Error("No hay empresa seleccionada");

      const punto_venta = parseInt(data.punto_venta);
      if (isNaN(punto_venta) || punto_venta < 1 || punto_venta > 9999) {
        throw new Error("El punto de venta debe ser un número entre 1 y 9999");
      }

      const payload = {
        company_id: currentCompany.id,
        punto_venta,
        descripcion: data.descripcion,
        tipo_comprobante: data.tipo_comprobante,
        prefijo: data.prefijo || null,
        ubicacion: data.ubicacion || null,
        active: data.active,
      };

      if (selectedPOS) {
        // Update
        const { error } = await (supabase as any)
          .from("pos_afip")
          .update(payload)
          .eq("id", selectedPOS.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await (supabase as any)
          .from("pos_afip")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(selectedPOS ? "Punto de venta actualizado" : "Punto de venta creado");
      queryClient.invalidateQueries({ queryKey: ["pos-afip"] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al guardar punto de venta");
    },
  });

  // Delete POS
  const deletePOSMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("pos_afip")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Punto de venta eliminado");
      queryClient.invalidateQueries({ queryKey: ["pos-afip"] });
      setDeleteDialogOpen(false);
      setSelectedPOS(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar punto de venta");
    },
  });

  const handleOpenDialog = (pos?: POSAfip) => {
    if (pos) {
      setSelectedPOS(pos);
      setFormData({
        punto_venta: pos.punto_venta.toString(),
        descripcion: pos.descripcion,
        tipo_comprobante: pos.tipo_comprobante,
        prefijo: pos.prefijo || "",
        ubicacion: pos.ubicacion || "",
        active: pos.active,
      });
    } else {
      setSelectedPOS(null);
      setFormData({
        punto_venta: "",
        descripcion: "",
        tipo_comprobante: "FACTURA_B",
        prefijo: "",
        ubicacion: "",
        active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPOS(null);
    setFormData({
      punto_venta: "",
      descripcion: "",
      tipo_comprobante: "FACTURA_B",
      prefijo: "",
      ubicacion: "",
      active: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    savePOSMutation.mutate(formData);
  };

  const formatComprobanteNumber = (puntoVenta?: number | null, numero?: number | null) => {
    const pvStr = String(puntoVenta ?? 0).padStart(4, "0");
    const numStr = String(numero ?? 0).padStart(8, "0");
    return `${pvStr}-${numStr}`;
  };

  if (!canView) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <AlertCircle className="h-16 w-16 text-warning" />
          <h2 className="text-2xl font-bold">Sin permisos</h2>
          <p className="text-muted-foreground text-center max-w-md">
            No tienes permisos para ver los puntos de venta AFIP.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              Puntos de Venta AFIP
              <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Beta
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los puntos de venta para facturación electrónica
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Punto de Venta
            </Button>
          )}
        </div>

        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Integración AFIP en Desarrollo</AlertTitle>
          <AlertDescription className="text-amber-600/80">
            La emisión real de comprobantes electrónicos con CAE de AFIP estará disponible próximamente. 
            Actualmente puedes configurar tus puntos de venta y preparar la integración.
          </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Puntos de Venta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{posPoints.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {posPoints.filter(p => p.active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Comprobantes Emitidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {posPoints.reduce((sum, p) => sum + (p.ultimo_numero ?? 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* POS List */}
        <Card>
          <CardHeader>
            <CardTitle>Puntos de Venta Configurados</CardTitle>
            <CardDescription>
              Listado de puntos de venta habilitados para facturación electrónica
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Cargando...</div>
            ) : posPoints.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay puntos de venta configurados</p>
                {canCreate && (
                  <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Punto de Venta
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {posPoints.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-lg font-bold">
                          PV {pos.punto_venta.toString().padStart(4, "0")}
                        </div>
                        <Badge variant={pos.active ? "default" : "secondary"}>
                          {pos.active ? "Activo" : "Inactivo"}
                        </Badge>
                        <Badge variant="outline">{pos.tipo_comprobante}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {pos.descripcion}
                      </div>
                      {pos.ubicacion && (
                        <div className="text-xs text-muted-foreground mt-1">
                          📍 {pos.ubicacion}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2 font-mono">
                        Último número: {formatComprobanteNumber(pos.punto_venta, pos.ultimo_numero)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(pos)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPOS(pos);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedPOS ? "Editar" : "Nuevo"} Punto de Venta AFIP
              </DialogTitle>
              <DialogDescription>
                Configura un punto de venta para facturación electrónica
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="punto_venta">Número de Punto de Venta *</Label>
                    <Input
                      id="punto_venta"
                      type="number"
                      min="1"
                      max="9999"
                      value={formData.punto_venta}
                      onChange={(e) => setFormData({ ...formData, punto_venta: e.target.value })}
                      placeholder="1"
                      required
                      disabled={!!selectedPOS}
                    />
                    <p className="text-xs text-muted-foreground">
                      Número de 1 a 9999 (asignado por AFIP)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo_comprobante">Tipo de Comprobante *</Label>
                    <Select
                      value={formData.tipo_comprobante}
                      onValueChange={(value) => setFormData({ ...formData, tipo_comprobante: value })}
                    >
                      <SelectTrigger id="tipo_comprobante">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FACTURA_A">Factura A</SelectItem>
                        <SelectItem value="FACTURA_B">Factura B</SelectItem>
                        <SelectItem value="FACTURA_C">Factura C</SelectItem>
                        <SelectItem value="FACTURA_E">Factura E (Exportación)</SelectItem>
                        <SelectItem value="NOTA_CREDITO">Nota de Crédito</SelectItem>
                        <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
                        <SelectItem value="TICKET">Ticket / Tique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción *</Label>
                  <Input
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Punto de venta principal / Sucursal Centro"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prefijo">Prefijo (opcional)</Label>
                    <Input
                      id="prefijo"
                      value={formData.prefijo}
                      onChange={(e) => setFormData({ ...formData, prefijo: e.target.value })}
                      placeholder="0001"
                      maxLength={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Prefijo para el número de comprobante
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ubicacion">Ubicación</Label>
                    <Input
                      id="ubicacion"
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                      placeholder="Sucursal Centro, Mostrador 1"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="space-y-0.5">
                    <Label>Estado del punto de venta</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilitar o deshabilitar este punto de venta
                    </p>
                  </div>
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={savePOSMutation.isPending}>
                  {savePOSMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar punto de venta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará el punto de venta{" "}
                <span className="font-bold">
                  PV {selectedPOS?.punto_venta.toString().padStart(4, "0")}
                </span>
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedPOS && deletePOSMutation.mutate(selectedPOS.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletePOSMutation.isPending ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
