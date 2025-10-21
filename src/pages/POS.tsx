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
import { Search, ShoppingCart, Trash2, Plus, Minus, Receipt, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import { generateReceiptPDF } from "@/components/pos/ReceiptPDF";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export default function POS() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discountRate, setDiscountRate] = useState(0);
  const [installments, setInstallments] = useState(1);
  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products", searchQuery],
    queryFn: async () => {
      let query = supabase.from("products").select("*").eq("active", true);
      
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,barcode.eq.${searchQuery},sku.eq.${searchQuery}`);
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
    setInstallments(1);
    toast.info("Carrito vaciado");
  };

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = (subtotal * discountRate) / 100;
  const taxRate = companySettings?.default_tax_rate || 0;
  const taxAmount = ((subtotal - discountAmount) * taxRate) / 100;
  const total = subtotal - discountAmount + taxAmount;
  const installmentAmount = installments > 1 ? total / installments : 0;

  const processSaleMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const saleNumber = `S-${Date.now()}`;
      
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          sale_number: saleNumber,
          user_id: user.id,
          subtotal: subtotal,
          discount: discountAmount,
          discount_rate: discountRate,
          tax: taxAmount,
          tax_rate: taxRate,
          total: total,
          payment_method: paymentMethod,
          installments: installments,
          installment_amount: installmentAmount,
          status: "completed"
        })
        .select()
        .single();

      if (saleError) throw saleError;

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

      return sale;
    },
    onSuccess: async (sale) => {
      toast.success("¡Venta procesada exitosamente!");
      
      // Register cash movement if payment method is cash
      if (paymentMethod === "cash") {
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
            // Register income movement
            await supabase
              .from("cash_movements")
              .insert({
                cash_register_id: cashRegister.id,
                user_id: user.id,
                type: "income",
                amount: total,
                category: "Venta",
                description: `Venta ${sale.sale_number}`,
                reference: sale.sale_number,
              });
            
            queryClient.invalidateQueries({ queryKey: ["cash-register"] });
          }
        } catch (error) {
          console.error("Error registrando movimiento de caja:", error);
          // Don't show error to user since sale was successful
        }
      }
      
      // Generate PDF receipt
      generateReceiptPDF({
        saleNumber: sale.sale_number,
        items: cart,
        subtotal: subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total: total,
        paymentMethod: paymentMethod,
        installments: installments > 1 ? installments : undefined,
        installmentAmount: installments > 1 ? installmentAmount : undefined,
        companyName: companySettings?.company_name || "Mi Empresa",
        companyAddress: companySettings?.address,
        companyPhone: companySettings?.phone,
        companyTaxId: companySettings?.tax_id,
        footer: companySettings?.receipt_footer,
      });

      clearCart();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
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
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-destructive">
                          <span>Descuento ({discountRate}%):</span>
                          <span>-${discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {taxAmount > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Impuesto ({taxRate}%):</span>
                          <span>${taxAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-primary">${total.toFixed(2)}</span>
                    </div>

                    <div className="space-y-2">
                      <Label>Método de Pago</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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

                    {paymentMethod === "card" && (
                      <div className="space-y-2">
                        <Label>Cuotas</Label>
                        <Select value={installments.toString()} onValueChange={(val) => setInstallments(parseInt(val))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 cuota</SelectItem>
                            <SelectItem value="3">3 cuotas</SelectItem>
                            <SelectItem value="6">6 cuotas</SelectItem>
                            <SelectItem value="12">12 cuotas</SelectItem>
                          </SelectContent>
                        </Select>
                        {installments > 1 && (
                          <p className="text-xs text-muted-foreground">
                            {installments} cuotas de ${installmentAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" onClick={clearCart} className="flex-1">
                        Limpiar
                      </Button>
                      <Button onClick={() => processSaleMutation.mutate()} disabled={processSaleMutation.isPending} className="flex-1">
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
    </Layout>
  );
}
