import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Receipt, Eye, Printer, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ReceiptPDF } from "@/components/pos/ReceiptPDF";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  const createDeliveryNoteMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("*, sale_items(*), customer:customers(name)")
        .eq("id", saleId)
        .single();
      
      if (saleError) throw saleError;

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

  const { data: sales } = useQuery({
    queryKey: ["sales", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select(`
          *,
          customer:customers(name, email, phone, document, address),
          sale_items(*)
        `)
        .order("created_at", { ascending: false });
      
      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`sale_number.ilike.%${sanitized}%`);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

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
    };
    return labels[method] || method;
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ventas</h1>
          <p className="text-muted-foreground">Historial de transacciones</p>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número de venta..."
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
                  <TableHead>Método de Pago</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales?.map((sale) => (
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
                      <Badge variant="outline">
                        {getPaymentMethodLabel(sale.payment_method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      ${Number(sale.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-success">
                        {sale.status === "completed" ? "Completada" : sale.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={() => handleViewDetails(sale)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={() => handlePrintReceipt(sale)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={() => createDeliveryNoteMutation.mutate(sale.id)}
                        disabled={createDeliveryNoteMutation.isPending}
                      >
                        <Truck className="h-4 w-4" />
                      </Button>
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

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                    Cerrar
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
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
