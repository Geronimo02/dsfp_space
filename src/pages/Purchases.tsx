import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Search, Eye, Trash2, ShoppingCart, Package, DollarSign, AlertCircle, CheckCircle2, Info, TrendingUp, BarChart3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { getErrorMessage } from "@/lib/errorHandling";
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
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  
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
    queryKey: ["purchases", searchQuery, currentCompany?.id, currentPage, pageSize],
    queryFn: async () => {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from("purchases")
        .select(`
          *,
          suppliers(name)
        `, { count: "exact" })
        .eq("company_id", currentCompany?.id)
        .order("purchase_date", { ascending: false })
        .range(from, to);

      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.ilike("purchase_number", `%${sanitized}%`);
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data, count: count || 0 };
    },
  });

  const totalPages = purchases ? Math.ceil(purchases.count / pageSize) : 0;

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("active", true)
        .limit(200)
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
        .order("name")
        .limit(500);
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

      // Prepare purchase data
      const purchaseData = {
        purchase_number: purchaseNumber,
        supplier_id: supplierId,
        user_id: user.id,
        subtotal: subtotal,
        tax: tax,
        total: total,
        status: "pending",
        company_id: currentCompany?.id,
      };

      // Prepare items data
      const items = purchaseItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        subtotal: item.subtotal,
        company_id: currentCompany?.id,
      }));

      // Call atomic RPC function to process purchase
      // This prevents race conditions by executing all updates in a single transaction
      const { data: purchase, error } = await supabase.rpc(
        'process_purchase_atomic',
        {
          p_purchase_data: purchaseData,
          p_items: items,
        }
      );

      if (error) throw error;
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
      toast.error(getErrorMessage(error));
      if (import.meta.env.DEV) {
        console.error("Purchase creation error:", error);
      }
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
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any; className: string }> = {
      pending: { 
        label: "Pendiente", 
        variant: "secondary",
        icon: AlertCircle,
        className: "gap-1"
      },
      partial: { 
        label: "Parcial", 
        variant: "outline",
        icon: TrendingUp,
        className: "gap-1 border-amber-500 text-amber-700 dark:text-amber-400"
      },
      paid: { 
        label: "Pagado", 
        variant: "default",
        icon: CheckCircle2,
        className: "gap-1 bg-green-500 hover:bg-green-600"
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Compras</h1>
            <p className="text-muted-foreground">Administra las compras a proveedores</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/reports?tab=purchases")}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Ver Reportes
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Lista de Compras</span>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button className="gap-2">
                          <Plus className="h-4 w-4" />
                          Nueva Compra
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Registrar nueva compra</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      Nueva Compra
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Sección Proveedor */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Info className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="text-sm font-semibold">Proveedor</h3>
                      </div>
                      <div>
                        <Label>Proveedor *</Label>
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
                    </div>

                    {/* Sección Productos */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <Package className="h-4 w-4 text-green-600 dark:text-green-500" />
                        </div>
                        <h3 className="text-sm font-semibold">Agregar Productos</h3>
                      </div>
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
                             placeholder="1"
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
                             placeholder="0.00"
                            value={currentCost}
                            onChange={(e) => setCurrentCost(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={addItem} className="w-full gap-2">
                            <Plus className="mr-2 h-4 w-4" />
                            Agregar
                          </Button>
                        </div>
                      </div>

                      {purchaseItems.length > 0 && (
                          <div className="border rounded-lg">
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
                                  <TableCell className="font-medium">{item.quantity}</TableCell>
                                  <TableCell className="text-blue-600 dark:text-blue-400">${item.unit_cost.toFixed(2)}</TableCell>
                                  <TableCell className="font-semibold text-green-600 dark:text-green-400">${item.subtotal.toFixed(2)}</TableCell>
                                <TableCell>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeItem(index)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Eliminar producto</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                          </div>
                      )}
                    </div>

                      {/* Sección Impuestos y Notas */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <div className="p-2 bg-amber-500/10 rounded-lg">
                            <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                          </div>
                          <h3 className="text-sm font-semibold">Impuestos y Notas</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>% Impuesto</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                           placeholder="0"
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
                           rows={3}
                        />
                      </div>
                        </div>
                    </div>

                      {/* Resumen de Totales */}
                      <div className="bg-muted/30 border rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold">Resumen</h3>
                        </div>
                        <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                          <span className="font-medium text-muted-foreground">${subtotal.toFixed(2)}</span>
                      </div>
                        <div className="flex justify-between text-sm">
                        <span>Impuesto ({taxRate}%):</span>
                          <span className="font-medium text-amber-600 dark:text-amber-500">${tax.toFixed(2)}</span>
                      </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t">
                        <span>Total:</span>
                          <span className="text-green-600 dark:text-green-400">${total.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => createPurchaseMutation.mutate()}
                      disabled={!supplierId || purchaseItems.length === 0}
                        className="w-full gap-2"
                    >
                        <CheckCircle2 className="h-4 w-4" />
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
                    <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                      <TableCell colSpan={7} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : purchases?.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={7} className="text-center">
                      No hay compras registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases?.data?.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">{purchase.purchase_number}</TableCell>
                      <TableCell>{format(new Date(purchase.purchase_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{purchase.suppliers?.name || "N/A"}</TableCell>
                        <TableCell className="font-semibold text-green-600 dark:text-green-400">${purchase.total.toFixed(2)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(purchase.payment_status)}</TableCell>
                      <TableCell>Usuario</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Ver detalle logic here
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver detalle</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {purchases && totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Purchases;
