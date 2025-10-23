import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, ShoppingCart, Trash2, Plus, Minus, Receipt, DollarSign, CreditCard, AlertCircle, Star, Award, Percent } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import { generateReceiptPDF } from "@/components/pos/ReceiptPDF";
import { Badge } from "@/components/ui/badge";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PaymentMethod {
  id: string;
  method: string;
  amount: number;
  installments?: number;
}

export default function POS() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState("cash");
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState("");
  const [currentInstallments, setCurrentInstallments] = useState(1);
  const [discountRate, setDiscountRate] = useState(0);
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [createCustomerDialog, setCreateCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products", searchQuery],
    queryFn: async () => {
      let query = supabase.from("products").select("*").eq("active", true);
      
      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`name.ilike.%${sanitized}%,barcode.eq.${sanitized},sku.eq.${sanitized}`);
        }
      }
      
      const { data, error } = await query.limit(10);
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

  const { data: customers } = useQuery({
    queryKey: ["customers-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_pos_view")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const handleBarcodeScanner = (code: string) => {
    setSearchQuery(code);
    toast.success(`Código escaneado: ${code}`);
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        toast.error("Stock insuficiente");
        return;
      }
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
          : item
      ));
    } else {
      if (product.stock < 1) {
        toast.error("Producto sin stock");
        return;
      }
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: Number(product.price),
        subtotal: Number(product.price)
      }]);
    }
    toast.success(`${product.name} agregado al carrito`);
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQuantity = item.quantity + change;
        if (newQuantity <= 0) return item;
        return {
          ...item,
          quantity: newQuantity,
          subtotal: newQuantity * item.unit_price
        };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
    toast.success("Producto eliminado del carrito");
  };

  const clearCart = () => {
    setCart([]);
    setDiscountRate(0);
    setCurrentInstallments(1);
    setSelectedCustomer(null);
    setPaymentMethods([]);
    setCurrentPaymentMethod("cash");
    setCurrentPaymentAmount("");
    setLoyaltyPointsToUse(0);
    toast.info("Carrito vaciado");
  };

  // Calculate loyalty discount based on customer tier
  const loyaltyDiscountRate = selectedCustomer && companySettings?.loyalty_enabled
    ? selectedCustomer.loyalty_tier === 'gold'
      ? companySettings.loyalty_gold_discount || 0
      : selectedCustomer.loyalty_tier === 'silver'
      ? companySettings.loyalty_silver_discount || 0
      : companySettings.loyalty_bronze_discount || 0
    : 0;

  // Calculate loyalty points value
  const loyaltyPointsValue = companySettings?.loyalty_enabled && loyaltyPointsToUse > 0
    ? loyaltyPointsToUse * (companySettings.loyalty_currency_per_point || 0.01)
    : 0;

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const manualDiscountAmount = (subtotal * discountRate) / 100;
  const loyaltyDiscountAmount = (subtotal * loyaltyDiscountRate) / 100;
  const totalDiscount = manualDiscountAmount + loyaltyDiscountAmount + loyaltyPointsValue;
  const taxRate = companySettings?.default_tax_rate || 0;
  const taxAmount = ((subtotal - totalDiscount) * taxRate) / 100;
  
  // Calculate card surcharge based on payment methods
  let cardSurchargeAmount = 0;
  const cardSurchargeRate = companySettings?.card_surcharge_rate || 0;
  
  if (paymentMethods.length > 0) {
    // Calculate surcharge for card payments
    const cardPayments = paymentMethods.filter(p => p.method === 'card');
    cardSurchargeAmount = cardPayments.reduce((sum, p) => {
      return sum + (p.amount * cardSurchargeRate / 100);
    }, 0);
  }
  
  const total = subtotal - totalDiscount + taxAmount + cardSurchargeAmount;
  const totalPaid = paymentMethods.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;

  const addPaymentMethod = () => {
    const amount = parseFloat(currentPaymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    if (totalPaid + amount > total) {
      toast.error("El monto excede el total");
      return;
    }
    
    setPaymentMethods([...paymentMethods, {
      id: Date.now().toString(),
      method: currentPaymentMethod,
      amount: amount,
      installments: currentPaymentMethod === 'card' ? currentInstallments : 1
    }]);
    setCurrentPaymentAmount("");
    setCurrentInstallments(1);
    toast.success("Método de pago agregado");
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.filter(p => p.id !== id));
    toast.success("Método de pago eliminado");
  };

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!newCustomerName.trim()) {
        throw new Error("El nombre es requerido");
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          email: newCustomerEmail.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (customer) => {
      toast.success("Cliente creado exitosamente");
      setSelectedCustomer(customer);
      setCreateCustomerDialog(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      queryClient.invalidateQueries({ queryKey: ["customers-pos"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear cliente");
    }
  });

  const processSaleMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Validate payment is complete
      if (remaining > 0.01) {
        throw new Error("Debe completar el pago antes de procesar la venta");
      }

      // Validate loyalty points
      if (loyaltyPointsToUse > 0 && selectedCustomer) {
        if (loyaltyPointsToUse > selectedCustomer.loyalty_points) {
          throw new Error("Puntos insuficientes");
        }
      }

      const saleNumber = `S-${Date.now()}`;
      
      // Determine primary payment method (the one with highest amount)
      const primaryPayment = paymentMethods.sort((a, b) => b.amount - a.amount)[0];
      const primaryMethod = primaryPayment ? primaryPayment.method : 'cash';
      const maxInstallments = Math.max(...paymentMethods.map(p => p.installments || 1));

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          sale_number: saleNumber,
          user_id: user.id,
          customer_id: selectedCustomer?.id || null,
          subtotal: subtotal,
          discount: totalDiscount,
          discount_rate: discountRate + loyaltyDiscountRate,
          tax: taxAmount,
          tax_rate: taxRate,
          total: total,
          payment_method: primaryMethod,
          installments: maxInstallments,
          installment_amount: maxInstallments > 1 ? total / maxInstallments : 0,
          status: "completed"
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(cart.map(item => ({
          sale_id: sale.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal
        })));

      if (itemsError) throw itemsError;

      // Insert payment methods
      const { error: paymentsError } = await supabase
        .from("sale_payments")
        .insert(paymentMethods.map(payment => ({
          sale_id: sale.id,
          payment_method: payment.method,
          amount: payment.amount,
          card_surcharge: payment.method === 'card' ? (payment.amount * cardSurchargeRate / 100) : 0,
          installments: payment.installments || 1
        })));

      if (paymentsError) throw paymentsError;

      // Update product stock
      for (const item of cart) {
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

      // Process loyalty points
      if (selectedCustomer && companySettings?.loyalty_enabled) {
        // Deduct used points
        if (loyaltyPointsToUse > 0) {
          await supabase
            .from("customers")
            .update({
              loyalty_points: selectedCustomer.loyalty_points - loyaltyPointsToUse
            })
            .eq("id", selectedCustomer.id);

          await supabase
            .from("loyalty_transactions")
            .insert({
              customer_id: selectedCustomer.id,
              points: -loyaltyPointsToUse,
              type: 'redeemed',
              reference_type: 'sale',
              reference_id: sale.id,
              description: `Puntos canjeados en venta ${sale.sale_number}`,
              user_id: user.id
            });
        }
      }

      return sale;
    },
    onSuccess: async (sale) => {
      toast.success("¡Venta procesada exitosamente!");
      
      // Register cash movements for cash payments
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Get open cash register
        const { data: cashRegister } = await supabase
          .from("cash_registers")
          .select("*")
          .eq("status", "open")
          .order("opening_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cashRegister && user) {
          const cashPayments = paymentMethods.filter(p => p.method === 'cash');
          
          for (const payment of cashPayments) {
            // Create detailed product list for description
            const productDetails = cart.map(item => 
              `${item.product_name} (${item.quantity}x$${item.unit_price.toFixed(2)})`
            ).join(', ');

            await supabase
              .from("cash_movements")
              .insert({
                cash_register_id: cashRegister.id,
                user_id: user.id,
                type: "income",
                amount: payment.amount,
                category: "Venta",
                description: `Venta ${sale.sale_number} - Productos: ${productDetails}`,
                reference: sale.sale_number,
              });
          }
          
          queryClient.invalidateQueries({ queryKey: ["cash-register"] });
        }
      } catch (error) {
        console.error("Error registrando movimiento de caja:", error);
      }
      
      // Generate PDF receipt
      generateReceiptPDF({
        saleNumber: sale.sale_number,
        items: cart,
        subtotal: subtotal,
        discount: totalDiscount,
        tax: taxAmount,
        cardSurcharge: cardSurchargeAmount > 0 ? cardSurchargeAmount : undefined,
        total: total,
        paymentMethod: paymentMethods.length > 0 ? 
          paymentMethods.map(p => {
            const methodName = p.method === 'cash' ? 'Efectivo' : p.method === 'card' ? 'Tarjeta' : 'Transferencia';
            const installmentInfo = p.installments && p.installments > 1 ? ` (${p.installments} cuotas)` : '';
            return `${methodName}: $${p.amount.toFixed(2)}${installmentInfo}`;
          }).join(', ') : 
          'Efectivo',
        companyName: companySettings?.company_name || "Mi Empresa",
        companyAddress: companySettings?.address,
        companyPhone: companySettings?.phone,
        companyTaxId: companySettings?.tax_id,
        footer: companySettings?.receipt_footer,
      });

      clearCart();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
      queryClient.invalidateQueries({ queryKey: ["customers-pos"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al procesar la venta");
    }
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Punto de Venta</h1>
          <p className="text-muted-foreground">Procesa ventas rápidamente</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader>
              <CardTitle>Productos</CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, código de barras o SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <BarcodeScanner onScan={handleBarcodeScanner} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {products?.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-medium transition-all" onClick={() => addToCart(product)}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-foreground">{product.name}</h3>
                          <p className="text-sm text-muted-foreground">Stock: {product.stock}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">${Number(product.price).toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrito
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">${item.unit_price.toFixed(2)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product_id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {cart.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Descuento (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={discountRate}
                        onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      {manualDiscountAmount > 0 && (
                        <div className="flex justify-between text-destructive">
                          <span>Descuento Manual ({discountRate}%):</span>
                          <span>-${manualDiscountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {loyaltyDiscountAmount > 0 && (
                        <div className="flex justify-between text-primary">
                          <span>Descuento Fidelidad ({loyaltyDiscountRate}%):</span>
                          <span>-${loyaltyDiscountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {loyaltyPointsValue > 0 && (
                        <div className="flex justify-between text-primary">
                          <span>Puntos Canjeados ({loyaltyPointsToUse}):</span>
                          <span>-${loyaltyPointsValue.toFixed(2)}</span>
                        </div>
                      )}
                      {taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Impuesto ({taxRate}%):</span>
                          <span>${taxAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {cardSurchargeAmount > 0 && (
                        <div className="flex justify-between text-warning">
                          <span>Recargo Tarjeta:</span>
                          <span>+${cardSurchargeAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-primary">${total.toFixed(2)}</span>
                    </div>

                    {selectedCustomer && companySettings?.loyalty_enabled && (
                      <div className="bg-primary/10 p-3 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Nivel: {selectedCustomer.loyalty_tier?.toUpperCase()}</span>
                          </div>
                          <Badge variant="secondary">
                            <Star className="h-3 w-3 mr-1" />
                            {selectedCustomer.loyalty_points || 0} pts
                          </Badge>
                        </div>
                        {loyaltyDiscountRate > 0 && (
                          <p className="text-xs text-muted-foreground">
                            <Percent className="h-3 w-3 inline mr-1" />
                            Descuento aplicado: {loyaltyDiscountRate}%
                          </p>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">Canjear Puntos</Label>
                          <Input
                            type="number"
                            min="0"
                            max={selectedCustomer.loyalty_points || 0}
                            value={loyaltyPointsToUse}
                            onChange={(e) => setLoyaltyPointsToUse(parseInt(e.target.value) || 0)}
                            placeholder="0"
                          />
                          <p className="text-xs text-muted-foreground">
                            Valor: ${loyaltyPointsValue.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Cliente (Opcional)</Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setCreateCustomerDialog(true)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Nuevo
                        </Button>
                      </div>
                      <Select 
                        value={selectedCustomer?.id || "none"} 
                        onValueChange={(val) => {
                          if (val === "none") {
                            setSelectedCustomer(null);
                            setLoyaltyPointsToUse(0);
                          } else {
                            const customer = customers?.find(c => c.id === val);
                            setSelectedCustomer(customer || null);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin cliente</SelectItem>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Métodos de Pago</Label>
                      <div className="space-y-2">
                        <Select value={currentPaymentMethod} onValueChange={setCurrentPaymentMethod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="card">Tarjeta</SelectItem>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {currentPaymentMethod === 'card' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Cuotas</Label>
                            <Select 
                              value={currentInstallments.toString()} 
                              onValueChange={(val) => setCurrentInstallments(parseInt(val))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 cuota (sin interés)</SelectItem>
                                <SelectItem value="3">3 cuotas</SelectItem>
                                <SelectItem value="6">6 cuotas</SelectItem>
                                <SelectItem value="12">12 cuotas</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Monto"
                            value={currentPaymentAmount}
                            onChange={(e) => setCurrentPaymentAmount(e.target.value)}
                            className="flex-1"
                          />
                          <Button type="button" size="icon" onClick={addPaymentMethod}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {paymentMethods.length > 0 && (
                      <div className="space-y-2">
                        {paymentMethods.map((pm) => {
                          const methodLabel = pm.method === 'cash' ? 'Efectivo' : pm.method === 'card' ? 'Tarjeta' : 'Transferencia';
                          const installmentInfo = pm.installments && pm.installments > 1 ? ` (${pm.installments} cuotas)` : '';
                          return (
                            <div key={pm.id} className="flex items-center justify-between p-2 bg-muted rounded">
                              <span className="text-sm">{methodLabel}: ${pm.amount.toFixed(2)}{installmentInfo}</span>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removePaymentMethod(pm.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                        <div className="flex justify-between pt-2 border-t font-medium">
                          <span>Pagado:</span>
                          <span>${totalPaid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Restante:</span>
                          <span className={remaining > 0.01 ? "text-destructive" : "text-success"}>
                            ${remaining.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={clearCart} className="flex-1">
                        Limpiar
                      </Button>
                      <Button 
                        onClick={() => processSaleMutation.mutate()} 
                        disabled={processSaleMutation.isPending || remaining > 0.01} 
                        className="flex-1"
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        {processSaleMutation.isPending ? "Procesando..." : "Cobrar"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Customer Dialog */}
      <Dialog open={createCustomerDialog} onOpenChange={setCreateCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="customer-name">Nombre *</Label>
              <Input
                id="customer-name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <Label htmlFor="customer-phone">Teléfono</Label>
              <Input
                id="customer-phone"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Teléfono"
              />
            </div>
            <div>
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                placeholder="Email"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateCustomerDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={() => createCustomerMutation.mutate()}
                disabled={createCustomerMutation.isPending}
              >
                {createCustomerMutation.isPending ? "Creando..." : "Crear Cliente"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
