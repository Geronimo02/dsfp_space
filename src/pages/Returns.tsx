import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, RotateCcw, CheckCircle, XCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function Returns() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: returns } = useQuery({
    queryKey: ["returns", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("returns")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`return_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: returnDetails } = useQuery({
    queryKey: ["return-details", selectedReturn?.id],
    queryFn: async () => {
      if (!selectedReturn?.id) return null;

      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          return_items(*)
        `)
        .eq("id", selectedReturn.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedReturn?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "approved" || status === "completed") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("returns")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;

      // Si es aprobada y método es credit_note, crear nota de crédito
      if (status === "approved") {
        const returnData = returns?.find(r => r.id === id);
        if (returnData && returnData.refund_method === "credit_note") {
          const { data: numberData } = await supabase.rpc("generate_credit_note_number");
          
          await supabase.from("credit_notes").insert({
            credit_note_number: numberData,
            return_id: id,
            customer_id: returnData.customer_id,
            amount: returnData.total,
            balance: returnData.total,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Estado actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["return-details"] });
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pendiente</Badge>;
      case "approved":
        return <Badge className="bg-success">Aprobada</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rechazada</Badge>;
      case "completed":
        return <Badge className="bg-primary">Completada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRefundMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      cash: "Efectivo",
      card: "Tarjeta",
      credit_note: "Nota de Crédito",
      exchange: "Cambio",
    };
    return labels[method] || method;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Devoluciones</h1>
          <p className="text-muted-foreground">Gestión de devoluciones y reembolsos</p>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o cliente..."
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
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Método Reembolso</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns?.map((returnItem) => (
                  <TableRow key={returnItem.id}>
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        {returnItem.return_number}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(returnItem.created_at), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>{returnItem.customer_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {returnItem.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getRefundMethodLabel(returnItem.refund_method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-destructive">
                      ${Number(returnItem.total).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => {
                          setSelectedReturn(returnItem);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {returnItem.status === "pending" && (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="text-success"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: returnItem.id,
                                status: "approved",
                              })
                            }
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="text-destructive"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                id: returnItem.id,
                                status: "rejected",
                              })
                            }
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                Detalle de Devolución - {selectedReturn?.return_number}
              </DialogTitle>
            </DialogHeader>

            {returnDetails && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Información General
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cliente:</span>
                        <span className="font-medium">{returnDetails.customer_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha:</span>
                        <span className="font-medium">
                          {format(new Date(returnDetails.created_at), "dd/MM/yyyy HH:mm", {
                            locale: es,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estado:</span>
                        {getStatusBadge(returnDetails.status)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Reembolso
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Método:</span>
                        <Badge variant="outline">
                          {getRefundMethodLabel(returnDetails.refund_method)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto:</span>
                        <span className="text-lg font-bold text-destructive">
                          ${Number(returnDetails.total).toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Motivo de Devolución</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground">{returnDetails.reason}</p>
                    {returnDetails.notes && (
                      <>
                        <Separator className="my-3" />
                        <p className="text-xs text-muted-foreground">{returnDetails.notes}</p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Productos Devueltos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-center">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unit.</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnDetails.return_items?.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              ${Number(item.unit_price).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${Number(item.subtotal).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                    Cerrar
                  </Button>
                  {returnDetails.status === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          updateStatusMutation.mutate({
                            id: returnDetails.id,
                            status: "rejected",
                          });
                          setIsDetailOpen(false);
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Rechazar
                      </Button>
                      <Button
                        className="bg-success"
                        onClick={() => {
                          updateStatusMutation.mutate({
                            id: returnDetails.id,
                            status: "approved",
                          });
                          setIsDetailOpen(false);
                        }}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Aprobar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
