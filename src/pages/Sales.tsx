import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Receipt, Eye, Printer, Truck, AlertCircle, CheckCircle2, Info, CreditCard, Wallet, User, FileText, RotateCcw, BarChart3, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ReceiptPDF } from "@/components/pos/ReceiptPDF";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Sales() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState("ALL");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const queryClient = useQueryClient();

  const createDeliveryNoteMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("*, sale_items(*), customer:customers(name)")
        .eq("id", saleId)
        .single();
      
      if (saleError) throw saleError;

      // Check if customer_id exists
      if (!sale.customer_id) {
        throw new Error("No se puede generar un remito sin cliente asignado");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data: numberData } = await supabase.rpc("generate_delivery_number");

      const customerName = sale.customer?.name || "Cliente";

      const { data: deliveryNote, error: noteError } = await supabase
        .from("delivery_notes")
        .insert({
          delivery_number: numberData,
          sale_id: saleId,
          customer_id: sale.customer_id,
          customer_name: customerName,
          user_id: user.id,
          subtotal: sale.subtotal,
          total: sale.total,
          status: "pending",
          company_id: currentCompany?.id,
        })
        .select()
        .single();

      if (noteError) throw noteError;

      const items = sale.sale_items.map((item: any) => ({
        delivery_note_id: deliveryNote.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        company_id: currentCompany?.id,
      }));

      await supabase.from("delivery_note_items").insert(items);
      return deliveryNote;
    },
    onSuccess: () => {
      toast.success("Remito generado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  // Query for products to filter
  const { data: products } = useQuery({
    queryKey: ["products-filter", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("company_id", currentCompany.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales } = useQuery({
    queryKey: ["sales", searchQuery, productFilter, currentCompany?.id, currentPage, pageSize],
    queryFn: async () => {
      if (!currentCompany?.id) return { data: [], count: 0 };
      
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from("sales")
        .select(`
          *,
          customer:customers(name, email, phone, document, address),
          sale_items(*, product:products(name)),
          returns(id, return_number, status, refund_method, total)
        `, { count: "exact" })
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false })
        .range(from, to);
      
      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`sale_number.ilike.%${sanitized}%`);
        }
      }
      
      const { data, error, count } = await query;
      if (error) throw error;

      // Filter by product on client side for current page only
      let filteredData = data;
      if (productFilter && productFilter !== "ALL") {
        filteredData = data?.filter(sale => 
          sale.sale_items?.some((item: any) => item.product_id === productFilter)
        ) || [];
      }
      
      return { data: filteredData, count: count || 0 };
    },
    enabled: !!currentCompany?.id,
  });

  const totalPages = sales ? Math.ceil(sales.count / pageSize) : 0;

  const { data: saleDetails } = useQuery({
    queryKey: ["sale-details", selectedSale?.id],
    queryFn: async () => {
      if (!selectedSale?.id) return null;
      
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          customer:customers(*),
          sale_items(*)
        `)
        .eq("id", selectedSale.id)
        .single();
      
      if (error) throw error;
      
      // Get user profile separately
      if (data?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.user_id)
          .single();
        
        return { ...data, profile };
      }
      
      return data;
    },
    enabled: !!selectedSale?.id,
  });

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      cash: "Efectivo",
      card: "Tarjeta",
      transfer: "Transferencia",
      credit: "Crédito",
    };
    return labels[method] || method;
  };

  const getPaymentBadgeClasses = (method: string) => {
    switch (method) {
      case "cash": return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
      case "card": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
      case "transfer": return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
      case "credit": return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return (
        <Badge className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completada
        </Badge>
      );
    }
    if (status === "pending") {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }
    if (status === "canceled") {
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Cancelada
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Info className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const handleViewDetails = (sale: any) => {
    setSelectedSale(sale);
    setIsDetailOpen(true);
  };

  const handlePrintReceipt = (sale: any) => {
    const saleData = {
      ...sale,
      items: sale.sale_items || [],
    };
    ReceiptPDF(saleData);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Ventas</h1>
            <p className="text-muted-foreground">Historial de transacciones</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/reports?tab=sales")}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Ver Reportes
          </Button>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número de venta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder="Filtrar por producto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los productos</SelectItem>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Método de Pago</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.data?.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      {sale.sale_number}
                    </TableCell>
                    <TableCell>
                      {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell>{sale.customer?.name || "Cliente general"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {sale.sale_items?.slice(0, 2).map((item: any, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {item.product_name} ({item.quantity})
                          </Badge>
                        ))}
                        {sale.sale_items && sale.sale_items.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{sale.sale_items.length - 2} más
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`flex items-center gap-1 font-medium ${getPaymentBadgeClasses(sale.payment_method)} whitespace-nowrap`}>
                        {sale.payment_method === 'cash' && <Wallet className="h-3 w-3" />}
                        {sale.payment_method === 'card' && <CreditCard className="h-3 w-3" />}
                        {sale.payment_method === 'transfer' && <Truck className="h-3 w-3" />}
                        {sale.payment_method === 'credit' && <AlertCircle className="h-3 w-3" />}
                        {getPaymentMethodLabel(sale.payment_method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      ${Number(sale.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(sale.status)}
                        {sale.returns && sale.returns.length > 0 && (
                          <Badge variant="outline" className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" />
                            {sale.returns[0].refund_method === 'credit_note' ? 'Nota de Crédito' : 'Devuelto'}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleViewDetails(sale); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalle</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {sale.customer_id && (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/customers?id=${sale.customer_id}`); }}
                                  >
                                    <User className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver cliente</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="icon" 
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); navigate(`/customer-account?customer=${sale.customer_id}`); }}
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver cuenta corriente</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handlePrintReceipt(sale); }}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Imprimir ticket</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); createDeliveryNoteMutation.mutate(sale.id); }}
                                disabled={createDeliveryNoteMutation.isPending}
                              >
                                <Truck className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generar remito</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {sales && totalPages > 1 && (
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

        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Detalle de Venta - {selectedSale?.sale_number}
              </DialogTitle>
            </DialogHeader>
            
            {saleDetails && (
              <div className="space-y-6">
                {/* Sale Information */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Información de Venta</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha:</span>
                        <span className="font-medium">
                          {format(new Date(saleDetails.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vendedor:</span>
                        <span className="font-medium">
                          {(saleDetails as any).profile?.full_name || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Método de Pago:</span>
                        <Badge variant="outline">{getPaymentMethodLabel(saleDetails.payment_method)}</Badge>
                      </div>
                      {saleDetails.installments > 1 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cuotas:</span>
                          <span className="font-medium">
                            {saleDetails.installments}x ${Number(saleDetails.installment_amount).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Información del Cliente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nombre:</span>
                        <span className="font-medium">{saleDetails.customer?.name || "Cliente general"}</span>
                      </div>
                      {saleDetails.customer?.email && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium text-xs">{saleDetails.customer.email}</span>
                        </div>
                      )}
                      {saleDetails.customer?.phone && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Teléfono:</span>
                          <span className="font-medium">{saleDetails.customer.phone}</span>
                        </div>
                      )}
                      {saleDetails.customer?.document && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Documento:</span>
                          <span className="font-medium">{saleDetails.customer.document}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Sale Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Productos</CardTitle>
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
                        {saleDetails.sale_items?.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">
                              ${Number(item.subtotal).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Totals */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-medium">${Number(saleDetails.subtotal).toFixed(2)}</span>
                      </div>
                      {Number(saleDetails.discount) > 0 && (
                        <div className="flex justify-between text-sm text-destructive">
                          <span>Descuento ({saleDetails.discount_rate}%):</span>
                          <span>-${Number(saleDetails.discount).toFixed(2)}</span>
                        </div>
                      )}
                      {Number(saleDetails.tax) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IVA ({saleDetails.tax_rate}%):</span>
                          <span className="font-medium">${Number(saleDetails.tax).toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-primary">${Number(saleDetails.total).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {saleDetails.notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Notas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{saleDetails.notes}</p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end gap-2 flex-wrap">
                  {saleDetails.customer_id && (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={() => navigate(`/customers?id=${saleDetails.customer_id}`)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        Ver Cliente
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => navigate(`/customer-account?customer=${saleDetails.customer_id}`)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Cuenta Corriente
                      </Button>
                    </>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => navigate(`/returns?sale=${saleDetails.id}`)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Crear Nota de Crédito
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      createDeliveryNoteMutation.mutate(saleDetails.id);
                      setIsDetailOpen(false);
                    }}
                    disabled={createDeliveryNoteMutation.isPending}
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Generar Remito
                  </Button>
                  <Button onClick={() => handlePrintReceipt(saleDetails)}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir Ticket
                  </Button>
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
