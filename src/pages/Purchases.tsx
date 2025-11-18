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
import { Plus, Search, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

interface PurchaseItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

const Purchases = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  
  // New purchase form state
  const [supplierId, setSupplierId] = useState("");
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentCost, setCurrentCost] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");

  // Fetch purchases
  const { data: purchases, isLoading } = useQuery({
    queryKey: ["purchases", searchQuery, currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("purchases")
        .select(`
          *,
          suppliers(name)
        `)
        .eq("company_id", currentCompany?.id)
        .order("purchase_date", { ascending: false });

      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.ilike("purchase_number", `%${sanitized}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["products", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Create purchase mutation
  const createPurchaseMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const subtotal = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

      // Generate purchase number
      const purchaseNumber = `PUR-${Date.now()}`;

      // Insert purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          purchase_number: purchaseNumber,
          supplier_id: supplierId,
          user_id: user.id,
          subtotal,
          tax,
          tax_rate: taxRate,
          total,
          notes,
          payment_status: "pending",
          company_id: currentCompany?.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Insert purchase items
      const items = purchaseItems.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        subtotal: item.subtotal,
        company_id: currentCompany?.id!
      }));

      const { error: itemsError } = await supabase
        .from("purchase_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Update product stock
      for (const item of purchaseItems) {
        const product = products?.find(p => p.id === item.product_id);
        if (product) {
          const { error: stockError } = await supabase
            .from("products")
            .update({ stock: product.stock + item.quantity })
            .eq("id", item.product_id);

          if (stockError) throw stockError;
        }
      }

      // Update supplier balance
      const supplier = suppliers?.find(s => s.id === supplierId);
      if (supplier) {
        const { error: balanceError } = await supabase
          .from("suppliers")
          .update({ current_balance: (supplier.current_balance || 0) + total })
          .eq("id", supplierId);

        if (balanceError) throw balanceError;
      }

      return purchase;
    },
    onSuccess: () => {
      toast.success("Compra registrada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Error al registrar la compra");
      console.error(error);
    },
  });

  const resetForm = () => {
    setSupplierId("");
    setPurchaseItems([]);
    setCurrentProduct("");
    setCurrentQuantity(1);
    setCurrentCost(0);
    setTaxRate(0);
    setNotes("");
  };

  const addItem = () => {
    if (!currentProduct) {
      toast.error("Selecciona un producto");
      return;
    }

    const product = products?.find(p => p.id === currentProduct);
    if (!product) return;

    const subtotal = currentQuantity * currentCost;
    const newItem: PurchaseItem = {
      product_id: product.id,
      product_name: product.name,
      quantity: currentQuantity,
      unit_cost: currentCost,
      subtotal,
    };

    setPurchaseItems([...purchaseItems, newItem]);
    setCurrentProduct("");
    setCurrentQuantity(1);
    setCurrentCost(0);
  };

  const removeItem = (index: number) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const subtotal = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * (taxRate / 100);
    return { subtotal, tax, total: subtotal + tax };
  };

  const { subtotal, tax, total } = calculateTotal();

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Pendiente", variant: "secondary" },
      partial: { label: "Parcial", variant: "outline" },
      paid: { label: "Pagado", variant: "default" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Compras</h1>
          <p className="text-muted-foreground">Administra las compras a proveedores</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Lista de Compras</span>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nueva Compra
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Nueva Compra</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Proveedor</Label>
                      <Select value={supplierId} onValueChange={setSupplierId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un proveedor" />
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

                    <div className="border rounded-lg p-4 space-y-4">
                      <h3 className="font-semibold">Agregar Productos</h3>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label>Producto</Label>
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
                        <div>
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            min="1"
                            value={currentQuantity}
                            onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div>
                          <Label>Costo Unitario</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={currentCost}
                            onChange={(e) => setCurrentCost(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button onClick={addItem} className="w-full">
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar
                          </Button>
                        </div>
                      </div>

                      {purchaseItems.length > 0 && (
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
                            {purchaseItems.map((item, index) => (
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
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>% Impuesto</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={taxRate}
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label>Notas</Label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notas adicionales..."
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-semibold">${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Impuesto ({taxRate}%):</span>
                        <span className="font-semibold">${tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => createPurchaseMutation.mutate()}
                      disabled={!supplierId || purchaseItems.length === 0}
                      className="w-full"
                    >
                      Registrar Compra
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por número de compra..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado Pago</TableHead>
                  <TableHead>Registrado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : purchases?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      No hay compras registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases?.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">{purchase.purchase_number}</TableCell>
                      <TableCell>{format(new Date(purchase.purchase_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{purchase.suppliers?.name || "N/A"}</TableCell>
                      <TableCell>${purchase.total.toFixed(2)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(purchase.payment_status)}</TableCell>
                      <TableCell>Usuario</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Purchases;
