import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Truck, Package, CheckCircle, Download } from "lucide-react";
import { generateDeliveryNotePDF } from "@/components/pdf/DeliveryNotePDF";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";

export default function DeliveryNotes() {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const { data: deliveryNotes, isLoading } = useQuery({
    queryKey: ["delivery-notes", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("delivery_notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`delivery_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pending" | "in_transit" | "delivered" | "cancelled" }) => {
      const updateData: any = { status };
      
      if (status === "delivered") {
        updateData.received_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("delivery_notes")
        .update(updateData)
        .eq("id", id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any }> = {
      pending: { variant: "secondary", label: "Pendiente", icon: Package },
      in_transit: { variant: "default", label: "En tránsito", icon: Truck },
      delivered: { variant: "default", label: "Entregado", icon: CheckCircle },
      cancelled: { variant: "destructive", label: "Cancelado", icon: null },
    };
    const config = variants[status] || { variant: "outline", label: status, icon: null };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {Icon && <Icon className="h-3 w-3" />}
        {config.label}
      </Badge>
    );
  };

  const handleDownloadPDF = async (deliveryNoteId: string) => {
    try {
      const { data: deliveryNote, error: noteError } = await supabase
        .from("delivery_notes")
        .select("*")
        .eq("id", deliveryNoteId)
        .single();
      
      if (noteError) throw noteError;

      const { data: items, error: itemsError } = await supabase
        .from("delivery_note_items")
        .select("*")
        .eq("delivery_note_id", deliveryNoteId);
      
      if (itemsError) throw itemsError;

      await generateDeliveryNotePDF(
        {
          ...deliveryNote,
          items: items || [],
        },
        companySettings
      );

      toast.success("PDF generado exitosamente");
    } catch (error: any) {
      toast.error("Error al generar PDF: " + error.message);
    }
  };

  const canEdit = hasPermission("delivery_notes", "edit");

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Remitos</h1>
            <p className="text-muted-foreground">Gestiona entregas y remitos de ventas</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Remitos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deliveryNotes?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Package className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deliveryNotes?.filter(d => d.status === "pending").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">En Tránsito</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deliveryNotes?.filter(d => d.status === "in_transit").length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Entregados</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deliveryNotes?.filter(d => d.status === "delivered").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por número o cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Fecha Entrega</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">Cargando...</TableCell>
                  </TableRow>
                ) : deliveryNotes && deliveryNotes.length > 0 ? (
                  deliveryNotes.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell className="font-medium">{note.delivery_number}</TableCell>
                      <TableCell>{note.customer_name}</TableCell>
                      <TableCell>${Number(note.total).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(note.status)}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {note.delivery_address || "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(note.created_at), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {note.delivery_date 
                          ? format(new Date(note.delivery_date), "dd/MM/yyyy", { locale: es })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(note.id)}
                            title="Descargar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <>
                              {note.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateStatusMutation.mutate({ 
                                    id: note.id, 
                                    status: "in_transit" 
                                  })}
                                  title="Marcar en tránsito"
                                >
                                  <Truck className="h-4 w-4" />
                                </Button>
                              )}
                              {note.status === "in_transit" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateStatusMutation.mutate({ 
                                    id: note.id, 
                                    status: "delivered" 
                                  })}
                                  title="Marcar como entregado"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No hay remitos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
