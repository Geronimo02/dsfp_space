import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PackageCheck, Search, Eye, CheckCircle2, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

const PurchaseReception = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch approved purchase orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["approved-orders", searchQuery, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = (supabase as any)
        .from("purchase_orders")
        .select(`
          *,
          suppliers(name),
          purchase_order_items(
            *,
            products(name, sku)
          )
        `)
        .eq("company_id", currentCompany.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.ilike("order_number", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch warehouses
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const receiveOrderMutation = useMutation({
    mutationFn: async (receptionData: any) => {
      if (!currentCompany?.id) throw new Error("No company selected");

      // Update order status
      const { error: orderError } = await (supabase as any)
        .from("purchase_orders")
        .update({ status: "received" })
        .eq("id", receptionData.order_id);

      if (orderError) throw orderError;

      // Update stock for each product
      for (const item of receptionData.items) {
        const { data: currentStock } = await (supabase as any)
          .from("warehouse_stock")
          .select("quantity")
          .eq("warehouse_id", receptionData.warehouse_id)
          .eq("product_id", item.product_id)
          .single();

        if (currentStock) {
          // Update existing stock
          const { error: stockError } = await (supabase as any)
            .from("warehouse_stock")
            .update({ 
              quantity: (currentStock as any).quantity + item.received_quantity,
              updated_at: new Date().toISOString()
            })
            .eq("warehouse_id", receptionData.warehouse_id)
            .eq("product_id", item.product_id);

          if (stockError) throw stockError;
        } else {
          // Create new stock entry
          const { error: stockError } = await (supabase as any)
            .from("warehouse_stock")
            .insert({
              warehouse_id: receptionData.warehouse_id,
              product_id: item.product_id,
              quantity: item.received_quantity,
              company_id: currentCompany.id,
            });

          if (stockError) throw stockError;
        }

        // Update product stock
        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", item.product_id)
          .single();

        if (product) {
          const { error: productError } = await supabase
            .from("products")
            .update({ stock: product.stock + item.received_quantity })
            .eq("id", item.product_id);

          if (productError) throw productError;
        }
      }

      // Create reception record
      const { error: receptionError } = await (supabase as any)
        .from("purchase_receptions")
        .insert({
          company_id: currentCompany.id,
          purchase_order_id: receptionData.order_id,
          warehouse_id: receptionData.warehouse_id,
          reception_date: new Date().toISOString(),
          notes: receptionData.notes,
        });

      if (receptionError) throw receptionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approved-orders"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse_stock"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Recepción registrada exitosamente");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar recepción");
    },
  });

  const handleReceiveOrder = () => {
    if (!selectedOrder || !warehouseId) {
      toast.error("Seleccione una orden y un depósito");
      return;
    }

    const items = selectedOrder.purchase_order_items.map((item: any) => ({
      product_id: item.product_id,
      ordered_quantity: item.quantity,
      received_quantity: receivedQuantities[item.id] || item.quantity,
    }));

    receiveOrderMutation.mutate({
      order_id: selectedOrder.id,
      warehouse_id: warehouseId,
      items,
      notes,
    });
  };

  const resetForm = () => {
    setSelectedOrder(null);
    setReceivedQuantities({});
    setWarehouseId("");
    setNotes("");
  };

  const openReceptionDialog = (order: any) => {
    setSelectedOrder(order);
    const initialQuantities: Record<string, number> = {};
    order.purchase_order_items.forEach((item: any) => {
      initialQuantities[item.id] = item.quantity;
    });
    setReceivedQuantities(initialQuantities);
    setIsDialogOpen(true);
  };

  const updateReceivedQuantity = (itemId: string, quantity: number) => {
    setReceivedQuantities(prev => ({
      ...prev,
      [itemId]: quantity,
    }));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Recepción de Mercadería</h1>
            <p className="text-muted-foreground">Registra la recepción de órdenes de compra</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle>Órdenes Pendientes de Recepción</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número de orden..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-full sm:w-[300px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">Cargando...</div>
            ) : orders && orders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha Orden</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.suppliers?.name}</TableCell>
                      <TableCell>{format(new Date(order.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {order.purchase_order_items?.length || 0} items
                        </Badge>
                      </TableCell>
                      <TableCell>${order.total_amount?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openReceptionDialog(order)}
                        >
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Recibir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                No hay órdenes pendientes de recepción
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Recibir Orden {selectedOrder?.order_number}
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <Label className="text-muted-foreground">Proveedor</Label>
                    <p className="font-medium">{selectedOrder.suppliers?.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Fecha Orden</Label>
                    <p className="font-medium">
                      {format(new Date(selectedOrder.created_at), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Depósito Destino *</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar depósito" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((warehouse) => (
                        <SelectItem key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Productos a Recibir</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Ordenado</TableHead>
                        <TableHead>A Recibir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.purchase_order_items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.products?.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.products?.sku}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.quantity}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={receivedQuantities[item.id] || item.quantity}
                              onChange={(e) => updateReceivedQuantity(item.id, Number(e.target.value))}
                              min="0"
                              max={item.quantity}
                              className="w-24"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <Label>Notas de Recepción</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observaciones sobre la recepción..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleReceiveOrder} 
                    disabled={receiveOrderMutation.isPending || !warehouseId}
                  >
                    {receiveOrderMutation.isPending ? "Registrando..." : "Confirmar Recepción"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default PurchaseReception;
