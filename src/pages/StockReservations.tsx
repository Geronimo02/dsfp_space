import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { Plus, Package, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface StockReservation {
  id: string;
  product_id: string;
  warehouse_id: string | null;
  quantity: number;
  reserved_for: string | null;
  reservation_type: string;
  reference_id: string | null;
  notes: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
  products?: { name: string; sku: string | null };
  warehouses?: { name: string };
}

export default function StockReservations() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    product_id: "",
    warehouse_id: "",
    quantity: "",
    reserved_for: "",
    notes: "",
    expires_at: "",
  });

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["stock-reservations", currentCompany?.id, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("stock_reservations")
        .select(`
          *,
          products(name, sku),
          warehouses(name)
        `)
        .eq("company_id", currentCompany?.id!)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`reserved_for.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StockReservation[];
    },
    enabled: !!currentCompany?.id,
  });

  const { data: products } = useQuery({
    queryKey: ["products", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, stock_physical, stock_reserved")
        .eq("company_id", currentCompany?.id!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name")
        .eq("company_id", currentCompany?.id!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const createReservationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase.from("stock_reservations").insert({
        company_id: currentCompany?.id!,
        product_id: data.product_id,
        warehouse_id: data.warehouse_id || null,
        quantity: parseInt(data.quantity),
        reserved_for: data.reserved_for || null,
        reservation_type: "manual",
        notes: data.notes || null,
        expires_at: data.expires_at || null,
        reserved_by: user.id,
        status: "active",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reserva creada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["stock-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      setIsDialogOpen(false);
      setFormData({
        product_id: "",
        warehouse_id: "",
        quantity: "",
        reserved_for: "",
        notes: "",
        expires_at: "",
      });
    },
    onError: (error: Error) => {
      toast.error("Error al crear reserva: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("stock_reservations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["stock-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: JSX.Element }> = {
      active: { variant: "default", icon: <Clock className="h-3 w-3" /> },
      released: { variant: "secondary", icon: <CheckCircle className="h-3 w-3" /> },
      expired: { variant: "outline", icon: <XCircle className="h-3 w-3" /> },
      completed: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
    };

    const config = variants[status] || variants.active;

    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status === "active" ? "Activa" : status === "released" ? "Liberada" : status === "expired" ? "Expirada" : "Completada"}
      </Badge>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id || !formData.quantity) {
      toast.error("Complete los campos requeridos");
      return;
    }
    createReservationMutation.mutate(formData);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Reservas de Stock</h1>
            <p className="text-muted-foreground">
              Gestiona las reservas de productos y separa stock físico del disponible
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Reserva
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Reserva de Stock</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="product_id">Producto *</Label>
                  <Select
                    value={formData.product_id}
                    onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} (Físico: {product.stock_physical}, Reservado: {product.stock_reserved})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="warehouse_id">Depósito</Label>
                  <Select
                    value={formData.warehouse_id}
                    onValueChange={(value) => setFormData({ ...formData, warehouse_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los depósitos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos los depósitos</SelectItem>
                      {warehouses?.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quantity">Cantidad *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="reserved_for">Reservado para</Label>
                  <Input
                    id="reserved_for"
                    placeholder="Cliente, pedido, etc."
                    value={formData.reserved_for}
                    onChange={(e) => setFormData({ ...formData, reserved_for: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="expires_at">Fecha de vencimiento</Label>
                  <Input
                    id="expires_at"
                    type="datetime-local"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createReservationMutation.isPending}>
                  {createReservationMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Reserva"
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reservas Activas</CardTitle>
            <Input
              placeholder="Buscar por cliente/referencia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !reservations?.length ? (
              <div className="text-center p-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay reservas de stock</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="border rounded-lg p-4 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{reservation.products?.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          SKU: {reservation.products?.sku || "N/A"}
                        </p>
                      </div>
                      {getStatusBadge(reservation.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cantidad:</span>{" "}
                        <span className="font-medium">{reservation.quantity}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Depósito:</span>{" "}
                        <span className="font-medium">{reservation.warehouses?.name || "Todos"}</span>
                      </div>
                      {reservation.reserved_for && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Reservado para:</span>{" "}
                          <span className="font-medium">{reservation.reserved_for}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Creado:</span>{" "}
                        <span className="font-medium">
                          {format(new Date(reservation.created_at), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      {reservation.expires_at && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Vence:</span>{" "}
                          <span className="font-medium">
                            {format(new Date(reservation.expires_at), "dd/MM/yyyy HH:mm")}
                          </span>
                        </div>
                      )}
                      {reservation.notes && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Notas:</span>{" "}
                          <span className="font-medium">{reservation.notes}</span>
                        </div>
                      )}
                    </div>

                    {reservation.status === "active" && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatusMutation.mutate({ id: reservation.id, status: "completed" })
                          }
                        >
                          Completar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStatusMutation.mutate({ id: reservation.id, status: "released" })
                          }
                        >
                          Liberar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
