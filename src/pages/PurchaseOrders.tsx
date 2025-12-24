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
import { Plus, Search, Eye, Trash2, FileCheck, Package, DollarSign, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

const PurchaseOrders = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const [supplierId, setSupplierId] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentCost, setCurrentCost] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch purchase orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase-orders", searchQuery, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = (supabase as any)
        .from("purchase_orders")
        .select(`
          *,
          suppliers(name),
          purchase_order_items(*)
        `)
        .eq("company_id", currentCompany.id)
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

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["products", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      if (!currentCompany?.id) throw new Error("No company selected");

      const { data: order, error: orderError } = await (supabase as any)
        .from("purchase_orders")
        .insert({
          company_id: currentCompany.id,
          supplier_id: orderData.supplier_id,
          order_number: `PO-${Date.now()}`,
          status: "pending",
          total_amount: orderData.total_amount,
          delivery_date: orderData.delivery_date,
          notes: orderData.notes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const itemsToInsert = orderData.items.map((item: OrderItem) => ({
        purchase_order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await (supabase as any)
        .from("purchase_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Orden de compra creada exitosamente");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear orden de compra");
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("purchase_orders")
        .update({ status })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Estado actualizado");
    },
    onError: () => {
      toast.error("Error al actualizar estado");
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await (supabase as any)
        .from("purchase_orders")
        .delete()
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Orden eliminada");
    },
    onError: () => {
      toast.error("Error al eliminar orden");
    },
  });

  const addItemToOrder = () => {
    if (!currentProduct || currentQuantity <= 0 || currentCost <= 0) {
      toast.error("Complete todos los campos del producto");
      return;
    }

    const product = products?.find(p => p.id === currentProduct);
    if (!product) return;

    const newItem: OrderItem = {
      product_id: currentProduct,
      product_name: product.name,
      quantity: currentQuantity,
      unit_cost: currentCost,
      subtotal: currentQuantity * currentCost,
    };

    setOrderItems([...orderItems, newItem]);
    setCurrentProduct("");
    setCurrentQuantity(1);
    setCurrentCost(0);
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleCreateOrder = () => {
    if (!supplierId || orderItems.length === 0) {
      toast.error("Seleccione un proveedor y agregue al menos un producto");
      return;
    }

    createOrderMutation.mutate({
      supplier_id: supplierId,
      items: orderItems,
      total_amount: calculateTotal(),
      delivery_date: deliveryDate,
      notes,
    });
  };

  const resetForm = () => {
    setSupplierId("");
    setOrderItems([]);
    setCurrentProduct("");
    setCurrentQuantity(1);
    setCurrentCost(0);
    setDeliveryDate("");
    setNotes("");
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any; icon: any }> = {
      pending: { label: "Pendiente", variant: "default", icon: Clock },
      approved: { label: "Aprobada", variant: "secondary", icon: CheckCircle2 },
      received: { label: "Recibida", variant: "default", icon: Package },
      cancelled: { label: "Cancelada", variant: "destructive", icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Órdenes de Compra</h1>
            <p className="text-muted-foreground">Gestiona las órdenes de compra a proveedores</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Orden
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Orden de Compra</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Proveedor *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proveedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Entrega</Label>
                    <Input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Productos</h3>
                  <div className="grid grid-cols-12 gap-2 mb-3">
                    <div className="col-span-5">
                      <Select value={currentProduct} onValueChange={setCurrentProduct}>
                        <SelectTrigger>
                          <SelectValue placeholder="Producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Cantidad"
                        value={currentQuantity}
                        onChange={(e) => setCurrentQuantity(Number(e.target.value))}
                        min="1"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        placeholder="Costo unitario"
                        value={currentCost}
                        onChange={(e) => setCurrentCost(Number(e.target.value))}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="col-span-2">
                      <Button type="button" onClick={addItemToOrder} className="w-full">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {orderItems.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Costo Unit.</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>${item.unit_cost.toFixed(2)}</TableCell>
                            <TableCell>${item.subtotal.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={3} className="text-right font-bold">
                            Total:
                          </TableCell>
                          <TableCell className="font-bold">
                            ${calculateTotal().toFixed(2)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas adicionales..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateOrder} disabled={createOrderMutation.isPending}>
                    {createOrderMutation.isPending ? "Creando..." : "Crear Orden"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Listado de Órdenes</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número de orden..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-[300px]"
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
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
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
                        {order.delivery_date ? format(new Date(order.delivery_date), "dd/MM/yyyy") : "-"}
                      </TableCell>
                      <TableCell>${order.total_amount?.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateOrderStatusMutation.mutate({
                                  orderId: order.id,
                                  status: "approved"
                                })}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteOrderMutation.mutate(order.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                No hay órdenes de compra registradas
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PurchaseOrders;
