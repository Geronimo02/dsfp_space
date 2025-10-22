import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, DollarSign, Package, CheckCircle, XCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export default function Reservations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewReservationOpen, setIsNewReservationOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentData, setPaymentData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: reservations } = useQuery({
    queryKey: ["reservations", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select(`
          *,
          reservation_items(*)
        `)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`reservation_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%`);
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
    queryKey: ["products-search", productSearch],
    queryFn: async () => {
      if (!productSearch) return [];
      
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%,barcode.ilike.%${productSearch}%`)
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: productSearch.length > 0,
  });

  const createReservationMutation = useMutation({
    mutationFn: async (reservationData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const customer = customers?.find(c => c.id === selectedCustomer);
      if (!customer) throw new Error("Cliente no encontrado");

      const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
      const { data: settings } = await supabase.from("company_settings").select("default_tax_rate").single();
      const taxRate = settings?.default_tax_rate || 0;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;

      const { data: reservationNumber } = await supabase.rpc("generate_reservation_number");

      const { data: reservation, error: reservationError } = await supabase
        .from("reservations")
        .insert({
          reservation_number: reservationNumber,
          customer_id: selectedCustomer,
          customer_name: customer.name,
          user_id: user.id,
          subtotal,
          tax,
          tax_rate: taxRate,
          total,
          remaining_amount: total,
          expiration_date: expirationDate || null,
          notes: notes || null,
        })
        .select()
        .single();

      if (reservationError) throw reservationError;

      const itemsToInsert = cart.map(item => ({
        reservation_id: reservation.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsError } = await supabase
        .from("reservation_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return reservation;
    },
    onSuccess: () => {
      toast.success("Reserva creada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setIsNewReservationOpen(false);
      resetReservationForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear reserva");
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error } = await supabase.from("reservation_payments").insert({
        reservation_id: selectedReservation.id,
        payment_method: data.payment_method,
        amount: parseFloat(data.amount),
        notes: data.notes || null,
        user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pago registrado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setIsPaymentDialogOpen(false);
      setPaymentData({ amount: "", payment_method: "cash", notes: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al registrar pago");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ 
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar estado");
    },
  });

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        subtotal: product.price,
      }]);
    }
    setProductSearch("");
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.product_id !== productId));
      return;
    }
    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, quantity, subtotal: quantity * item.unit_price }
        : item
    ));
  };

  const resetReservationForm = () => {
    setCart([]);
    setSelectedCustomer("");
    setExpirationDate("");
    setNotes("");
    setProductSearch("");
  };

  const handleCreateReservation = () => {
    if (!selectedCustomer) {
      toast.error("Seleccione un cliente");
      return;
    }
    if (cart.length === 0) {
      toast.error("Agregue al menos un producto");
      return;
    }
    createReservationMutation.mutate({});
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Activa</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-100 text-green-800">Completada</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelada</Badge>;
      case "expired":
        return <Badge variant="secondary">Vencida</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reservas / Layaway</h1>
            <p className="text-muted-foreground">Gestiona productos apartados con anticipo</p>
          </div>
          <Dialog open={isNewReservationOpen} onOpenChange={setIsNewReservationOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetReservationForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Reserva
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nueva Reserva</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Vencimiento</Label>
                    <Input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Buscar Producto</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre, SKU o código de barras"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {productSearch && products && products.length > 0 && (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className="p-3 hover:bg-accent cursor-pointer border-b last:border-0"
                          onClick={() => addToCart(product)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">
                                SKU: {product.sku} | Stock: {product.stock}
                              </p>
                            </div>
                            <p className="font-bold">${Number(product.price).toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Productos en Reserva</Label>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Precio Unit.</TableHead>
                          <TableHead>Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.map((item) => (
                          <TableRow key={item.product_id}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                                className="w-20"
                              />
                            </TableCell>
                            <TableCell>${Number(item.unit_price).toFixed(2)}</TableCell>
                            <TableCell>${Number(item.subtotal).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {cart.length > 0 && (
                    <div className="text-right font-bold text-lg pt-2">
                      Total: ${Number(subtotal).toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas adicionales sobre la reserva"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsNewReservationOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateReservation}>
                    Crear Reserva
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar reservas..."
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pagado</TableHead>
                  <TableHead>Restante</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations?.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell className="font-medium">{reservation.reservation_number}</TableCell>
                    <TableCell>{reservation.customer_name}</TableCell>
                    <TableCell>${Number(reservation.total).toFixed(2)}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      ${Number(reservation.paid_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-orange-600 font-medium">
                      ${Number(reservation.remaining_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                    <TableCell>{format(new Date(reservation.created_at), "dd/MM/yyyy", { locale: es })}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {reservation.status === "active" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedReservation(reservation);
                              setIsPaymentDialogOpen(true);
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Pago
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: "completed" })}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Completar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: "cancelled" })}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Cancelar
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

        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Pago - {selectedReservation?.reservation_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Monto Restante</p>
                <p className="text-2xl font-bold">
                  ${Number(selectedReservation?.remaining_amount || 0).toFixed(2)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Monto a Pagar *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Método de Pago *</Label>
                <Select
                  value={paymentData.payment_method}
                  onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Notas adicionales"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => addPaymentMutation.mutate(paymentData)}>
                  Registrar Pago
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
