import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, FileText, Trash2, Eye, CheckCircle, XCircle, Send, Download, ShoppingCart } from "lucide-react";
import { generateQuotationPDF } from "@/components/pdf/QuotationPDF";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { sanitizeSearchQuery } from "@/lib/searchUtils";

interface QuotationItem {
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export default function Quotations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [discountRate, setDiscountRate] = useState(0);
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const { data: quotations, isLoading } = useQuery({
    queryKey: ["quotations", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("quotations")
        .select("*")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`quotation_number.ilike.%${sanitized}%,customer_name.ilike.%${sanitized}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("active", true)
        .order("name");
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

  const createQuotationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer || items.length === 0) {
        throw new Error("Debe seleccionar un cliente y agregar al menos un producto");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const customer = customers?.find(c => c.id === selectedCustomer);
      if (!customer) throw new Error("Cliente no encontrado");

      // Generar número de presupuesto
      const { data: numberData, error: numberError } = await supabase
        .rpc("generate_quotation_number");
      if (numberError) throw numberError;

      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const discount = subtotal * (discountRate / 100);
      const taxRate = 0; // Por ahora sin impuesto, se puede agregar después
      const tax = (subtotal - discount) * (taxRate / 100);
      const total = subtotal - discount + tax;

      // Crear presupuesto
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .insert({
          quotation_number: numberData,
          customer_id: selectedCustomer,
          customer_name: customer.name,
          user_id: user.id,
          subtotal,
          discount,
          discount_rate: discountRate,
          tax,
          tax_rate: taxRate,
          total,
          notes,
          valid_until: validUntil || null,
          status: "draft",
        })
        .select()
        .single();

      if (quotationError) throw quotationError;

      // Crear items
      const quotationItems = items.map(item => ({
        quotation_id: quotation.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from("quotation_items")
        .insert(quotationItems);

      if (itemsError) throw itemsError;

      return quotation;
    },
    onSuccess: () => {
      toast.success("Presupuesto creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error("Error al crear presupuesto: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted" }) => {
      const { error } = await supabase
        .from("quotations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const convertToSaleMutation = useMutation({
    mutationFn: async (quotationId: string) => {
      // Obtener presupuesto con items
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .single();
      
      if (quotationError) throw quotationError;

      const { data: quotationItems, error: itemsError } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId);
      
      if (itemsError) throw itemsError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Generar número de venta
      const { data: salesData } = await supabase
        .from("sales")
        .select("sale_number")
        .order("created_at", { ascending: false })
        .limit(1);

      const lastNumber = salesData?.[0]?.sale_number || "VENTA-00000000-0000";
      const parts = lastNumber.split("-");
      const counter = parseInt(parts[2]) + 1;
      const saleNumber = `VENTA-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${counter.toString().padStart(4, "0")}`;

      // Crear venta
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          sale_number: saleNumber,
          customer_id: quotation.customer_id,
          user_id: user.id,
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          discount_rate: quotation.discount_rate,
          tax: quotation.tax,
          tax_rate: quotation.tax_rate,
          total: quotation.total,
          payment_method: "credit",
          installments: 1,
          notes: `Convertido desde presupuesto ${quotation.quotation_number}`,
          status: "completed",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Crear items de venta
      const saleItems = quotationItems.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      const { error: saleItemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

      if (saleItemsError) throw saleItemsError;

      // Actualizar stock de productos
      for (const item of quotationItems) {
        if (item.product_id) {
          const { data: product } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.product_id)
            .single();
          
          if (product) {
            await supabase
              .from("products")
              .update({ stock: product.stock - item.quantity })
              .eq("id", item.product_id);
          }
        }
      }

      // Marcar presupuesto como convertido
      const { error: updateError } = await supabase
        .from("quotations")
        .update({ 
          status: "converted",
          converted_to_sale_id: sale.id 
        })
        .eq("id", quotationId);

      if (updateError) throw updateError;

      return sale;
    },
    onSuccess: () => {
      toast.success("Presupuesto convertido a venta exitosamente");
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (error: Error) => {
      toast.error("Error al convertir: " + error.message);
    },
  });

  const addItem = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;

    const newItem: QuotationItem = {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: Number(product.price),
      subtotal: Number(product.price),
    };

    setItems([...items, newItem]);
  };

  const handleDownloadPDF = async (quotationId: string) => {
    try {
      // Obtener presupuesto con items
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .single();
      
      if (quotationError) throw quotationError;

      const { data: items, error: itemsError } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId);
      
      if (itemsError) throw itemsError;

      await generateQuotationPDF(
        {
          ...quotation,
          items: items || [],
        },
        companySettings
      );

      toast.success("PDF generado exitosamente");
    } catch (error: any) {
      toast.error("Error al generar PDF: " + error.message);
    }
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].subtotal = quantity * newItems[index].unit_price;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setSelectedCustomer("");
    setItems([]);
    setNotes("");
    setValidUntil("");
    setDiscountRate(0);
  };

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = subtotal * (discountRate / 100);
  const total = subtotal - discount;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Borrador" },
      sent: { variant: "default", label: "Enviado" },
      accepted: { variant: "default", label: "Aceptado" },
      rejected: { variant: "destructive", label: "Rechazado" },
      expired: { variant: "outline", label: "Vencido" },
      converted: { variant: "default", label: "Convertido" },
    };
    const config = variants[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const canCreate = hasPermission("quotations", "create");
  const canEdit = hasPermission("quotations", "edit");

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Presupuestos</h1>
            <p className="text-muted-foreground">Gestiona presupuestos para clientes</p>
          </div>
          {canCreate && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Presupuesto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear Presupuesto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Cliente *</Label>
                      <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Válido hasta</Label>
                      <Input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Agregar Productos</Label>
                    <Select onValueChange={addItem}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - ${Number(product.price).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {items.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Precio</TableHead>
                          <TableHead>Subtotal</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItemQuantity(index, Number(e.target.value))}
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>${item.unit_price.toFixed(2)}</TableCell>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Descuento (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={discountRate}
                        onChange={(e) => setDiscountRate(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Notas</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas adicionales..."
                    />
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    {discountRate > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Descuento ({discountRate}%):</span>
                        <span>-${discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => createQuotationMutation.mutate()}>
                    Crear Presupuesto
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
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
                  <TableHead>Válido hasta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">Cargando...</TableCell>
                  </TableRow>
                ) : quotations && quotations.length > 0 ? (
                  quotations.map((quotation) => (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">{quotation.quotation_number}</TableCell>
                      <TableCell>{quotation.customer_name}</TableCell>
                      <TableCell>${Number(quotation.total).toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                      <TableCell>
                        {quotation.valid_until 
                          ? format(new Date(quotation.valid_until), "dd/MM/yyyy", { locale: es })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(quotation.created_at), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadPDF(quotation.id)}
                            title="Descargar PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {canEdit && quotation.status === "draft" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ 
                                  id: quotation.id, 
                                  status: "sent" 
                                })}
                                title="Marcar como enviado"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ 
                                  id: quotation.id, 
                                  status: "accepted" 
                                })}
                                title="Marcar como aceptado"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {canEdit && quotation.status === "accepted" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => convertToSaleMutation.mutate(quotation.id)}
                              title="Convertir a venta"
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Convertir
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No hay presupuestos
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
