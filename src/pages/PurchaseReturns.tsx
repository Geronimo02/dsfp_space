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
import { Plus, Search, Eye, Trash2, TrendingDown, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

interface ReturnItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  reason: string;
}

const PurchaseReturns = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  
  const [supplierId, setSupplierId] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentReason, setCurrentReason] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch purchase returns
  const { data: returns, isLoading } = useQuery({
    queryKey: ["purchase-returns", searchQuery, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = (supabase as any)
        .from("purchase_returns")
        .select(`
          *,
          suppliers(name),
          purchases(purchase_number),
          purchase_return_items(
            *,
            products(name, sku)
          )
        `)
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.ilike("return_number", `%${searchQuery}%`);
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

  // Fetch purchases by supplier
  const { data: purchases } = useQuery({
    queryKey: ["purchases-by-supplier", supplierId, currentCompany?.id],
    queryFn: async () => {
      if (!supplierId || !currentCompany?.id) return [];
      const { data, error } = await (supabase as any)
        .from("purchases")
        .select(`
          *,
          purchase_items(
            *,
            products(id, name, sku)
          )
        `)
        .eq("company_id", currentCompany.id)
        .eq("supplier_id", supplierId)
        .eq("status", "completed");
      if (error) throw error;
      return data || [];
    },
    enabled: !!supplierId && !!currentCompany?.id,
  });

  // Get products from selected purchase
  const selectedPurchaseProducts = purchases?.find(p => p.id === purchaseId)?.purchase_items || [];

  const createReturnMutation = useMutation({
    mutationFn: async (returnData: any) => {
      if (!currentCompany?.id) throw new Error("No company selected");

      // Calculate total
      const total = returnData.items.reduce((sum: number, item: ReturnItem) => 
        sum + (item.quantity * item.unit_cost), 0
      );

      const { data: returnRecord, error: returnError } = await (supabase as any)
        .from("purchase_returns")
        .insert({
          company_id: currentCompany.id,
          supplier_id: returnData.supplier_id,
          purchase_id: returnData.purchase_id,
          return_number: `PR-${Date.now()}`,
          total_amount: total,
          status: "pending",
          notes: returnData.notes,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      const itemsToInsert = returnData.items.map((item: ReturnItem) => ({
        purchase_return_id: (returnRecord as any).id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        reason: item.reason,
      }));

      const { error: itemsError } = await (supabase as any)
        .from("purchase_return_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Update stock for each product
      for (const item of returnData.items) {
        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", item.product_id)
          .single();

        if (product) {
          const { error: stockError } = await supabase
            .from("products")
            .update({ stock: Math.max(0, product.stock - item.quantity) })
            .eq("id", item.product_id);

          if (stockError) throw stockError;
        }
      }

      return returnRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-returns"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Devolución creada exitosamente");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear devolución");
    },
  });

  const deleteReturnMutation = useMutation({
    mutationFn: async (returnId: string) => {
      const { error } = await (supabase as any)
        .from("purchase_returns")
        .delete()
        .eq("id", returnId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-returns"] });
      toast.success("Devolución eliminada");
    },
    onError: () => {
      toast.error("Error al eliminar devolución");
    },
  });

  const addItemToReturn = () => {
    if (!currentProduct || currentQuantity <= 0 || !currentReason) {
      toast.error("Complete todos los campos del producto");
      return;
    }

    const product = selectedPurchaseProducts.find((p: any) => p.product_id === currentProduct);
    if (!product) return;

    const newItem: ReturnItem = {
      product_id: currentProduct,
      product_name: product.products?.name || "",
      quantity: currentQuantity,
      unit_cost: product.unit_cost || 0,
      reason: currentReason,
    };

    setReturnItems([...returnItems, newItem]);
    setCurrentProduct("");
    setCurrentQuantity(1);
    setCurrentReason("");
  };

  const removeItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return returnItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const handleCreateReturn = () => {
    if (!supplierId || !purchaseId || returnItems.length === 0) {
      toast.error("Complete todos los campos requeridos");
      return;
    }

    createReturnMutation.mutate({
      supplier_id: supplierId,
      purchase_id: purchaseId,
      items: returnItems,
      notes,
    });
  };

  const resetForm = () => {
    setSupplierId("");
    setPurchaseId("");
    setReturnItems([]);
    setCurrentProduct("");
    setCurrentQuantity(1);
    setCurrentReason("");
    setNotes("");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: "default",
      approved: "secondary",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Devoluciones a Proveedores</h1>
            <p className="text-muted-foreground">Gestiona las devoluciones de productos a proveedores</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Devolución
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Devolución a Proveedor</DialogTitle>
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
                    <Label>Compra Original *</Label>
                    <Select value={purchaseId} onValueChange={setPurchaseId} disabled={!supplierId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar compra" />
                      </SelectTrigger>
                      <SelectContent>
                        {purchases?.map((purchase) => (
                          <SelectItem key={purchase.id} value={purchase.id}>
                            {purchase.purchase_number} - {format(new Date(purchase.purchase_date), "dd/MM/yyyy")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {purchaseId && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Productos a Devolver</h3>
                    <div className="grid grid-cols-12 gap-2 mb-3">
                      <div className="col-span-4">
                        <Select value={currentProduct} onValueChange={setCurrentProduct}>
                          <SelectTrigger>
                            <SelectValue placeholder="Producto" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedPurchaseProducts.map((item: any) => (
                              <SelectItem key={item.product_id} value={item.product_id}>
                                {item.products?.name}
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
                      <div className="col-span-4">
                        <Input
                          placeholder="Motivo"
                          value={currentReason}
                          onChange={(e) => setCurrentReason(e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button type="button" onClick={addItemToReturn} className="w-full">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {returnItems.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Costo Unit.</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead>Subtotal</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {returnItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.product_name}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>${item.unit_cost.toFixed(2)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                              <TableCell>${(item.quantity * item.unit_cost).toFixed(2)}</TableCell>
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
                            <TableCell colSpan={4} className="text-right font-bold">
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
                )}

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas adicionales sobre la devolución..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateReturn} disabled={createReturnMutation.isPending}>
                    {createReturnMutation.isPending ? "Creando..." : "Crear Devolución"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Listado de Devoluciones</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número..."
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
            ) : returns && returns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Compra Original</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((returnItem: any) => (
                    <TableRow key={returnItem.id}>
                      <TableCell className="font-medium">{returnItem.return_number}</TableCell>
                      <TableCell>{returnItem.suppliers?.name}</TableCell>
                      <TableCell>{returnItem.purchases?.purchase_number}</TableCell>
                      <TableCell>{format(new Date(returnItem.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>${returnItem.total_amount?.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedReturn(returnItem)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {returnItem.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteReturnMutation.mutate(returnItem.id)}
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
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                No hay devoluciones registradas
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default PurchaseReturns;
