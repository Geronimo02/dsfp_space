import { useRef, useEffect } from "react";
import { useRateLimit } from "@/hooks/useRateLimit";
import { getErrorMessage } from "@/lib/errorHandling";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  DollarSign, 
  CreditCard, 
  Package,
  Mail, 
  MessageCircle, 
  Printer, 
  X, 
  Check,
  Award,
  Star,
  Percent,
  Receipt,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReceiptPDF } from "@/components/pos/ReceiptPDF";
import { InvoicePDF } from "@/components/pos/InvoicePDF";
import { ProductSearch } from "@/components/pos/ProductSearch";
import { CartSummary } from "@/components/pos/CartSummary";
import { CustomerSelector } from "@/components/pos/CustomerSelector";
import { PaymentSection } from "@/components/pos/PaymentSection";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";
import { usePOSState, type CartItem, type PaymentMethod } from "@/hooks/usePOSState";

export default function POS() {
  const { currentCompany } = useCompany();
  const [state, dispatch] = usePOSState();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Destructure state for easier access
  const {
    searchQuery,
    cart,
    paymentMethods,
    currentPaymentMethod,
    currentPaymentAmount,
    currentInstallments,
    currentPaymentCurrency,
    discountRate,
    loyaltyPointsToUse,
    selectedCustomer,
    selectedWarehouse,
    selectedPOSAfipId,
    createCustomerDialog,
    newCustomerName,
    newCustomerPhone,
    newCustomerEmail,
    newCustomerDocument,
    showReceiptOptions,
    lastSaleData,
    tempPhoneNumber,
    tempEmail,
    isProcessingSale,
    walkInSale,
    selectedPaymentMethod,
  } = state;
  
  // Helper functions for state updates (maintain readability while using reducer)
  const setSearchQuery = (value: string) => dispatch({ type: 'SET_SEARCH_QUERY', payload: value });
  const setCart = (value: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    const newCart = typeof value === 'function' ? value(cart) : value;
    dispatch({ type: 'SET_CART', payload: newCart });
  };
  const setPaymentMethods = (value: PaymentMethod[]) => dispatch({ type: 'SET_PAYMENT_METHODS', payload: value });
  const setCurrentPaymentMethod = (value: string) => dispatch({ type: 'SET_CURRENT_PAYMENT_METHOD', payload: value });
  const setCurrentPaymentAmount = (value: string) => dispatch({ type: 'SET_CURRENT_PAYMENT_AMOUNT', payload: value });
  const setCurrentInstallments = (value: number) => dispatch({ type: 'SET_CURRENT_INSTALLMENTS', payload: value });
  const setCurrentPaymentCurrency = (value: string) => dispatch({ type: 'SET_CURRENT_PAYMENT_CURRENCY', payload: value });
  const setDiscountRate = (value: number) => dispatch({ type: 'SET_DISCOUNT_RATE', payload: value });
  const setLoyaltyPointsToUse = (value: number) => dispatch({ type: 'SET_LOYALTY_POINTS_TO_USE', payload: value });
  const setSelectedCustomer = (value: any | null) => dispatch({ type: 'SET_SELECTED_CUSTOMER', payload: value });
  const setSelectedWarehouse = (value: string) => dispatch({ type: 'SET_SELECTED_WAREHOUSE', payload: value });
  const setSelectedPOSAfipId = (value: string) => dispatch({ type: 'SET_SELECTED_POS_AFIP_ID', payload: value });
  const setCreateCustomerDialog = (value: boolean) => dispatch({ type: 'SET_CREATE_CUSTOMER_DIALOG', payload: value });
  const setNewCustomerName = (value: string) => dispatch({ type: 'SET_NEW_CUSTOMER_NAME', payload: value });
  const setNewCustomerPhone = (value: string) => dispatch({ type: 'SET_NEW_CUSTOMER_PHONE', payload: value });
  const setNewCustomerEmail = (value: string) => dispatch({ type: 'SET_NEW_CUSTOMER_EMAIL', payload: value });
  const setNewCustomerDocument = (value: string) => dispatch({ type: 'SET_NEW_CUSTOMER_DOCUMENT', payload: value });
  const setShowReceiptOptions = (value: boolean) => dispatch({ type: 'SET_SHOW_RECEIPT_OPTIONS', payload: value });
  const setLastSaleData = (value: any | null) => dispatch({ type: 'SET_LAST_SALE_DATA', payload: value });
  const setTempPhoneNumber = (value: string) => dispatch({ type: 'SET_TEMP_PHONE_NUMBER', payload: value });
  const setTempEmail = (value: string) => dispatch({ type: 'SET_TEMP_EMAIL', payload: value });
  const setIsProcessingSale = (value: boolean) => dispatch({ type: 'SET_IS_PROCESSING_SALE', payload: value });
  const setWalkInSale = (value: boolean) => dispatch({ type: 'SET_WALK_IN_SALE', payload: value });
  const setSelectedPaymentMethod = (value: string) => dispatch({ type: 'SET_SELECTED_PAYMENT_METHOD', payload: value });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products", searchQuery, selectedCustomer?.price_list_id, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = supabase.from("products").select("*").eq("active", true).eq("company_id", currentCompany.id).limit(500);
      
      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`name.ilike.%${sanitized}%,barcode.eq.${sanitized},sku.eq.${sanitized}`);
        }
      }
      
      const { data: productsData, error } = await query.limit(10);
      if (error) throw error;
      
      // If customer has a price list, fetch prices from that list
      if (selectedCustomer?.price_list_id && productsData) {
        const productIds = productsData.map((p: any) => p.id);
        const { data: pricesData } = await supabase
          .from("product_prices")
          .select("product_id, price")
          .eq("price_list_id", selectedCustomer.price_list_id)
          .in("product_id", productIds);
        
        // Map prices to products
        const pricesMap = new Map(pricesData?.map((p: any) => [p.product_id, p.price]) || []);
        return productsData.map((product: any) => ({
          ...product,
          price: pricesMap.get(product.id) ?? product.price, // Use price list price or fallback to default
        }));
      }
      
      return productsData;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", currentCompany.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // AFIP POS points
  const { data: posPoints } = useQuery({
    queryKey: ["pos-afip", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [] as any[];
      const { data, error } = await (supabase as any)
        .from("pos_afip")
        .select("id, punto_venta, descripcion, tipo_comprobante, active")
        .eq("company_id", currentCompany.id)
        .eq("active", true)
        .order("punto_venta", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentCompany?.id,
  });

  useEffect(() => {
    if (posPoints && posPoints.length > 0 && !selectedPOSAfipId) {
      setSelectedPOSAfipId(posPoints[0].id);
    }
  }, [posPoints]);

  // Exchange rates query
  const { data: exchangeRates } = useQuery({
    queryKey: ["exchange-rates-pos", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Helper function to convert from one currency to another
  const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return amount;
    
    const rates = exchangeRates || [];
    
    // Convert to ARS first if needed
    let amountInARS = amount;
    if (fromCurrency !== 'ARS') {
      const fromRate = rates.find(r => r.currency === fromCurrency);
      if (fromRate) {
        amountInARS = amount * fromRate.rate;
      }
    }
    
    // Then convert from ARS to target currency if needed
    if (toCurrency !== 'ARS') {
      const toRate = rates.find(r => r.currency === toCurrency);
      if (toRate && toRate.rate > 0) {
        return amountInARS / toRate.rate;
      }
    }
    
    return amountInARS;
  };

  const { data: customers } = useQuery({
    queryKey: ["customers-pos", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("customer_pos_view")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("company_id", currentCompany.id)
        .eq("active", true)
        .order("is_main", { ascending: false });
      
      if (error) throw error;
      // Auto-select main warehouse
      if (data && data.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(data[0].id);
      }
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const handleBarcodeScanner = (code: string) => {
    setSearchQuery(code);
    toast.success(`Código escaneado: ${code}`);
  };

  const addToCart = (product: any) => {
    if (product.stock === 0) {
      toast.error("Producto sin stock");
      return;
    }

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
    dispatch({ type: 'CLEAR_CART' });
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

  // 1. TOTALES BASE (sin financiación)
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const manualDiscountAmount = (subtotal * discountRate) / 100;
  const loyaltyDiscountAmount = (subtotal * loyaltyDiscountRate) / 100;
  const totalDiscount = manualDiscountAmount + loyaltyDiscountAmount + loyaltyPointsValue;
  const taxRate = companySettings?.default_tax_rate || 0;
  const taxAmount = ((subtotal - totalDiscount) * taxRate) / 100;
  const total_base = subtotal - totalDiscount + taxAmount;
  
  const cardSurchargeRate = companySettings?.card_surcharge_rate || 0;
  
  // 2. SUMATORIAS de pagos por tramos
  const totalBaseAmount = paymentMethods.reduce((sum, p) => sum + p.baseAmount, 0);
  const recargo_pagado = paymentMethods.reduce((sum, p) => sum + p.surcharge, 0);
  const total_cobrado = paymentMethods.reduce((sum, p) => sum + p.amount, 0);
  
  // 3. RESTANTE y POTENCIAL
  const restante_base = total_base - totalBaseAmount;
  
  let potentialCardSurcharge = 0;
  if (currentPaymentMethod === 'card' && cardSurchargeRate > 0 && restante_base > 0) {
    // Aplicar recargo siempre que haya tasa configurada (no solo cuotas > 1)
    const tasa_recargo = cardSurchargeRate * currentInstallments / 100;
    potentialCardSurcharge = restante_base * tasa_recargo;
  }
  
  // 4. TOTAL A PAGAR (actual, sin potencial)
  const total = total_base + recargo_pagado;
  const remaining = restante_base;

  const addPaymentMethod = (autoBaseAmount?: number) => {
    const baseAmount = autoBaseAmount || parseFloat(currentPaymentAmount);
    if (!baseAmount || baseAmount <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    
    // Convert payment amount to ARS for comparison
    const baseAmountInARS = convertCurrency(baseAmount, currentPaymentCurrency, 'ARS');
    
    // Validar que no exceda el restante_base
    if (baseAmountInARS > restante_base + 0.01) {
      toast.error("El monto base excede el restante");
      return;
    }
    
    // Calcular recargo siempre que sea tarjeta y haya tasa configurada
    let surcharge = 0;
    if (currentPaymentMethod === 'card' && cardSurchargeRate > 0) {
      const tasa_recargo = cardSurchargeRate * currentInstallments / 100;
      surcharge = baseAmountInARS * tasa_recargo;
    }
    
    const totalAmount = baseAmountInARS + surcharge;
    
    setPaymentMethods([...paymentMethods, {
      id: Date.now().toString(),
      method: currentPaymentMethod,
      baseAmount: baseAmountInARS,
      surcharge: surcharge,
      amount: totalAmount,
      installments: currentPaymentMethod === 'card' ? currentInstallments : 1,
      currency: currentPaymentCurrency
    }]);
    setCurrentPaymentAmount("");
    setCurrentInstallments(1);
    toast.success(`Método de pago agregado (${currentPaymentCurrency})`);
  };

  const payTotalAmount = () => {
    if (restante_base <= 0) {
      toast.error("Ya está pagado el total");
      return;
    }
    // Pagar exactamente restante_base (el recargo se calcula automáticamente en addPaymentMethod)
    addPaymentMethod(restante_base);
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
          document: newCustomerDocument.trim() || null,
          company_id: currentCompany?.id,
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
      setNewCustomerDocument("");
      queryClient.invalidateQueries({ queryKey: ["customers-pos"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear cliente");
    }
  });

  const saleRateLimiter = useRateLimit({ maxAttempts: 10, windowMs: 60000 }); // 10 ventas por minuto

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
          warehouse_id: selectedWarehouse || null,
          subtotal: subtotal,
          discount: totalDiscount,
          discount_rate: discountRate + loyaltyDiscountRate,
          tax: taxAmount,
          tax_rate: taxRate,
          total: total,
          payment_method: primaryMethod,
          installments: maxInstallments,
          installment_amount: maxInstallments > 1 ? total / maxInstallments : 0,
          status: "completed",
          company_id: currentCompany?.id,
          // AFIP fields (optional)
          pos_afip_id: selectedPOSAfipId || null,
          tipo_comprobante: determineComprobante(companySettings, selectedCustomer) || 'TICKET',
          condicion_iva_cliente: selectedCustomer?.condicion_iva || 'consumidor_final',
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
          subtotal: item.subtotal,
          company_id: currentCompany?.id!
        })));

      if (itemsError) throw itemsError;

      // Insert payment methods
      const { error: paymentsError } = await supabase
        .from("sale_payments")
        .insert(paymentMethods.map(payment => ({
          sale_id: sale.id,
          payment_method: payment.method,
          amount: payment.amount,
          card_surcharge: payment.surcharge,
          installments: payment.installments || 1,
          company_id: currentCompany?.id!
        })));

      if (paymentsError) throw paymentsError;

      // Update warehouse stock
      if (selectedWarehouse) {
        for (const item of cart) {
          const { data: warehouseStock } = await supabase
            .from("warehouse_stock")
            .select("stock")
            .eq("warehouse_id", selectedWarehouse)
            .eq("product_id", item.product_id)
            .single();
          
          if (warehouseStock) {
            await supabase
              .from("warehouse_stock")
              .update({ stock: warehouseStock.stock - item.quantity })
              .eq("warehouse_id", selectedWarehouse)
              .eq("product_id", item.product_id);
          }
        }
      }

      // Update product stock (total)
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
              user_id: user.id,
              company_id: currentCompany?.id,
            });
        }
      }

      return sale;
    },
    onSuccess: async (sale) => {
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
                company_id: currentCompany?.id,
              });
          }
          
          queryClient.invalidateQueries({ queryKey: ["cash-register"] });
        }
      } catch (error) {
        console.error("Error registrando movimiento de caja:", error);
      }
      
      // Preparar datos completos de la venta para el modal de opciones
      const completeSaleData = {
        ...sale,
        items: cart.map(item => ({
          ...item,
          total: item.unit_price * item.quantity,
          product: {
            name: item.product_name,
            code: ''
          }
        })),
        customer: selectedCustomer,
        subtotal: subtotal,
        tax: taxAmount,
        total: total,
        paymentMethods: paymentMethods
      };

      // Mostrar modal de opciones en lugar de generar PDF directamente
      setLastSaleData(completeSaleData);
      setShowReceiptOptions(true);

      // Limpiar carrito y datos
      clearCart();
      
      // Mostrar mensaje de éxito
      toast.success("¡Venta procesada exitosamente!");
      
      // Refrescar datos
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["sales-stats"] });
      queryClient.invalidateQueries({ queryKey: ["customers-pos"] });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      toast.error(message);
      if (import.meta.env.DEV) {
        console.error("Sale processing error:", error);
      }
    }
  });

  // Eliminar la función completeSale ya que ahora usamos processSaleMutation
  // const completeSale = async () => { ... }

  const handlePrintReceipt = () => {
    if (lastSaleData) {
      ReceiptPDF(lastSaleData);
      setShowReceiptOptions(false);
      setLastSaleData(null);
    }
  };

  const handlePrintInvoice = () => {
    if (!lastSaleData) return;

    // Determinar tipo de comprobante sugerido
    const tipo = determineComprobante(companySettings, lastSaleData.customer);

    // Obtener Punto de Venta seleccionado
    const pvSel = (posPoints || []).find((p: any) => p.id === (lastSaleData.pos_afip_id || selectedPOSAfipId));
    const puntoVenta = pvSel?.punto_venta || null;

    // Datos de empresa
    const comp = currentCompany || companySettings || {};

    // Mapear items
    const items = (lastSaleData.items || []).map((it: any) => ({
      product_name: it.product_name || it.product?.name || "Producto",
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      subtotal: Number(it.subtotal != null ? it.subtotal : (Number(it.unit_price) || 0) * (Number(it.quantity) || 1)),
    }));

    InvoicePDF({
      tipoComprobante: tipo.startsWith('FACTURA') ? tipo : 'FACTURA_B',
      puntoVenta,
      numeroComprobante: lastSaleData.numero_comprobante || null,
      cae: lastSaleData.cae || null,
      caeVencimiento: lastSaleData.fecha_vencimiento_cae || null,
      fecha: lastSaleData.created_at,
      company: {
        razon_social: (comp as any).razon_social || (comp as any).name || undefined,
        nombre_fantasia: (comp as any).nombre_fantasia || undefined,
        cuit: (comp as any).tax_id || undefined,
        condicion_iva: (comp as any).condicion_iva || undefined,
        address: (comp as any).address || undefined,
        phone: (comp as any).phone || undefined,
      },
      customer: lastSaleData.customer ? {
        name: lastSaleData.customer.name,
        condicion_iva: lastSaleData.customer.condicion_iva || undefined,
        tipo_documento: lastSaleData.customer.tipo_documento || (lastSaleData.customer.document ? 'dni' : undefined),
        numero_documento: lastSaleData.customer.numero_documento || lastSaleData.customer.document || undefined,
      } : null,
      items,
      subtotal: Number(lastSaleData.subtotal) || 0,
      discount: Number(lastSaleData.discount) || 0,
      tax: Number(lastSaleData.tax) || 0,
      tax_rate: Number(lastSaleData.tax_rate) || undefined,
      total: Number(lastSaleData.total) || 0,
      paymentMethods: (lastSaleData.paymentMethods || []).map((pm: any) => ({
        method: pm.method,
        amount: Number(pm.amount) || 0,
        installments: pm.installments || 1,
      })),
    });

    setShowReceiptOptions(false);
    setLastSaleData(null);
  };

  const handleEmailReceipt = async () => {
    if (!lastSaleData) return;

    try {
      // Usar email del cliente o el email temporal ingresado
      const email = lastSaleData.customer?.email || tempEmail;
      
      if (!email.trim()) {
        toast.error("Se requiere un email para enviar el comprobante");
        return;
      }

      // Generar PDF
      const pdfBlob = await generatePDFBlob(lastSaleData);
      
      if (pdfBlob) {
        // Crear URL para el PDF
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Crear un enlace temporal para descargar el PDF
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `Ticket_${lastSaleData.sale_number}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Limpiar el URL del objeto
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
        
        // Generar contenido del email
        const emailSubject = `Comprobante de Venta - Ticket #${lastSaleData.sale_number}`;
        const emailBody = `
Estimado/a cliente,

Le adjuntamos el comprobante de su compra:

Ticket: ${lastSaleData.sale_number}
Fecha: ${format(new Date(lastSaleData.created_at), "dd/MM/yyyy HH:mm")}
Cliente: ${lastSaleData.customer?.name || 'Venta Directa'}
Total: $${lastSaleData.total.toFixed(2)}

El archivo PDF se ha descargado automáticamente. Por favor, adjúntelo a su email.

¡Gracias por su compra!

Saludos cordiales.
        `.trim();

        // Abrir cliente de email con datos prellenados
        const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.open(mailtoUrl);
        
        toast.success("PDF descargado y cliente de email abierto. Adjunta el archivo manualmente.", {
          duration: 5000
        });
      } else {
        toast.error("Error al generar el PDF");
      }
      
      setShowReceiptOptions(false);
      setLastSaleData(null);
      setTempPhoneNumber("");
      setTempEmail("");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al procesar el email");
    }
  };

  const handleWhatsAppReceipt = async () => {
    if (!lastSaleData) return;

    try {
      // Usar número del cliente o el número temporal ingresado
      const phoneNumber = lastSaleData.customer?.phone || tempPhoneNumber;
      
      if (!phoneNumber.trim()) {
        toast.error("Se requiere un número de teléfono para WhatsApp");
        return;
      }

      // Generar PDF primero
      const pdfBlob = await generatePDFBlob(lastSaleData);
      
      if (pdfBlob) {
        // Crear URL para el PDF
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Crear un enlace temporal para descargar el PDF
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `Ticket_${lastSaleData.sale_number}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Limpiar el URL del objeto
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
        
        // Generar mensaje para WhatsApp con instrucciones
        const message = `
🧾 *COMPROBANTE DE VENTA*

📋 Ticket: ${lastSaleData.sale_number}
📅 Fecha: ${format(new Date(lastSaleData.created_at), "dd/MM/yyyy HH:mm")}
${lastSaleData.customer ? `👤 Cliente: ${lastSaleData.customer.name}` : '👤 Cliente: Venta Directa'}

💰 *TOTAL: $${lastSaleData.total.toFixed(2)}*

📎 El comprobante PDF se ha descargado automáticamente. 
📤 Por favor, adjúntalo manualmente a este chat de WhatsApp.

¡Gracias por su compra! 🙏
        `.trim();

        // Abrir WhatsApp con el mensaje
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^\d]/g, '')}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
        
        toast.success("PDF descargado y WhatsApp abierto. Adjunta el archivo manualmente.", {
          duration: 5000
        });
      } else {
        // Fallback al mensaje de texto si falla el PDF
        const textMessage = generateTextMessage(lastSaleData);
        const encodedMessage = encodeURIComponent(textMessage);
        const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^\d]/g, '')}?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');
        toast.success("WhatsApp abierto con comprobante de texto");
      }
      
      setShowReceiptOptions(false);
      setLastSaleData(null);
      setTempPhoneNumber("");
      setTempEmail("");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al procesar el comprobante");
    }
  };

  const handleSkipReceipt = () => {
    setShowReceiptOptions(false);
    setLastSaleData(null);
    setTempPhoneNumber("");
    setTempEmail("");
  };

  // Filtrar productos basado en la búsqueda
  const filteredProducts = products?.filter(product => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.barcode?.toLowerCase().includes(query) ||
      product.sku?.toLowerCase().includes(query)
    );
  }) || [];

  // Función para sanitizar búsqueda
  const sanitizeSearchQuery = (query: string) => {
    return query.trim().toLowerCase();
  };

  // Función para generar PDF como Blob
  const generatePDFBlob = async (saleData: any): Promise<Blob | null> => {
    try {
      // Importar jsPDF dinámicamente
      const { jsPDF } = await import('jspdf');
      
      // Obtener configuración de tickets con manejo de errores
      let config = {
        paper_width: '80mm',
        font_size: 'small',
        company_name: 'Mi Empresa',
        company_address: '',
        company_phone: '',
        footer_message: '¡Gracias por su compra!'
      };

      try {
        const { data: ticketConfig, error } = await supabase
          .from('companies')
          .select('*')
          .single();

        if (!error && ticketConfig) {
          config = {
            paper_width: '80mm', // Valor fijo por defecto
            font_size: 'small', // Valor fijo por defecto
            company_name: ticketConfig.name || 'Mi Empresa',
            company_address: ticketConfig.address || '',
            company_phone: ticketConfig.phone || '',
            footer_message: ticketConfig.receipt_footer || '¡Gracias por su compra!'
          };
        }
      } catch (configError) {
        console.warn('Error fetching ticket config, using defaults:', configError);
      }
      
      // Crear nuevo documento PDF (usando formato estándar de ticket)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 150] // Formato de ticket estándar 80mm
      });

      // Configurar fuente y tamaño estándar
      const fontSize = 8;
      doc.setFontSize(fontSize);

      let yPos = 10;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 5;

      // Encabezado de la empresa
      if (config.company_name) {
        doc.setFont(undefined, 'bold');
        doc.text(config.company_name, pageWidth / 2, yPos, { align: 'center' });
        yPos += 5;
      }

      if (config.company_address) {
        doc.setFont(undefined, 'normal');
        doc.setFontSize(fontSize - 1);
        doc.text(config.company_address, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }

      if (config.company_phone) {
        doc.text(config.company_phone, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      }

      yPos += 3;

      // Información de la venta
      doc.setFontSize(fontSize);
      doc.text(`Ticket: ${saleData.sale_number}`, margin, yPos);
      yPos += 4;
      
      doc.text(`Fecha: ${format(new Date(saleData.created_at), "dd/MM/yyyy HH:mm")}`, margin, yPos);
      yPos += 4;
      
      doc.text(`Cliente: ${saleData.customer?.name || 'Venta Directa'}`, margin, yPos);
      yPos += 6;

      // Línea separadora
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      // Productos
      doc.text('PRODUCTOS:', margin, yPos);
      yPos += 4;

      saleData.items.forEach((item: any) => {
        doc.text(`${item.product.name}`, margin, yPos);
        yPos += 3;
        doc.text(`${item.quantity} x $${item.unit_price.toFixed(2)} = $${item.total.toFixed(2)}`, margin + 2, yPos);
        yPos += 4;
      });

      yPos += 2;

      // Línea separadora
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      // Totales
      doc.text(`Subtotal: $${saleData.subtotal.toFixed(2)}`, margin, yPos);
      yPos += 4;
      
      doc.text(`Impuestos: $${saleData.tax.toFixed(2)}`, margin, yPos);
      yPos += 4;
      
      doc.setFont(undefined, 'bold');
      doc.text(`TOTAL: $${saleData.total.toFixed(2)}`, margin, yPos);
      yPos += 6;

      // Pie de página
      if (config.footer_message) {
        doc.setFont(undefined, 'normal');
        doc.setFontSize(fontSize - 1);
        doc.text(config.footer_message, pageWidth / 2, yPos, { align: 'center' });
      }

      // Generar Blob
      const pdfBlob = doc.output('blob');
      return pdfBlob;
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  // Función auxiliar para mensaje de texto (fallback)
  const generateTextMessage = (saleData: any) => {
    return `
🧾 *COMPROBANTE DE VENTA*

📋 Ticket: ${saleData.sale_number}
📅 Fecha: ${format(new Date(saleData.created_at), "dd/MM/yyyy HH:mm")}
${saleData.customer ? `👤 Cliente: ${saleData.customer.name}` : '👤 Cliente: Venta Directa'}

📦 *PRODUCTOS:*
${saleData.items.map((item: any) => 
  `• ${item.product.name}\n  ${item.quantity} x $${item.unit_price.toFixed(2)} = $${item.total.toFixed(2)}`
).join('\n')}

💰 *TOTALES:*
Subtotal: $${saleData.subtotal.toFixed(2)}
Impuestos: $${saleData.tax.toFixed(2)}
*TOTAL: $${saleData.total.toFixed(2)}*

¡Gracias por su compra! 🙏
    `.trim();
  };

  // Determina el tipo de comprobante AFIP según condición IVA
  const determineComprobante = (company: any, customer: any): string => {
    const empresa = company?.condicion_iva || 'responsable_inscripto';
    const cliente = customer?.condicion_iva || 'consumidor_final';

    if (!company?.afip_enabled) return 'TICKET';

    // Mapeo básico común en AR
    if (empresa === 'responsable_inscripto') {
      if (cliente === 'responsable_inscripto') return 'FACTURA_A';
      if (cliente === 'consumidor_final' || cliente === 'monotributista' || cliente === 'exento') return 'FACTURA_B';
    }

    // Otros casos
    if (empresa === 'monotributista') return 'FACTURA_C';
    if (empresa === 'exento') return 'FACTURA_C';

    return 'TICKET';
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Punto de Venta</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Sistema de gestión de ventas</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-2 py-1 text-xs md:text-sm">
              <DollarSign className="mr-1 h-3 w-3 md:h-4 md:w-4" />
              ${total.toFixed(2)}
            </Badge>
            <Badge variant={cart.length > 0 ? "default" : "secondary"} className="px-2 py-1 text-xs md:text-sm">
              <ShoppingCart className="mr-1 h-3 w-3 md:h-4 md:w-4" />
              {cart.length}
            </Badge>
          </div>
        </div>

        {/* Grid principal - En móvil muestra carrito primero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Panel de productos */}
          <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
            <ProductSearch
              searchQuery={searchQuery}
              onSearchChange={(value) => setSearchQuery(sanitizeSearchQuery(value))}
              products={filteredProducts}
              isLoading={isLoadingProducts}
              onAddToCart={addToCart}
              searchInputRef={searchInputRef}
            />
          </div>

          {/* Panel de carrito y checkout */}
          <div className="space-y-4 order-1 lg:order-2">
            <Card>
              <CardHeader className="p-3 md:p-6">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <ShoppingCart className="h-4 w-4 md:h-5 md:w-5" />
                  Carrito
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <CartSummary
                  cart={cart}
                  discountRate={discountRate}
                  onDiscountChange={setDiscountRate}
                  onUpdateQuantity={updateQuantity}
                  onRemoveItem={removeFromCart}
                  onClearCart={clearCart}
                  loyaltyDiscount={loyaltyDiscountAmount + loyaltyPointsValue}
                />

                {cart.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Depósito</Label>
                        <Select 
                          value={selectedWarehouse} 
                          onValueChange={setSelectedWarehouse}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar depósito..." />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses?.map((warehouse) => (
                              <SelectItem key={warehouse.id} value={warehouse.id}>
                                {warehouse.code} - {warehouse.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <CustomerSelector
                        customers={customers || []}
                        selectedCustomer={selectedCustomer}
                        onSelectCustomer={(customer) => {
                          setSelectedCustomer(customer);
                          if (!customer) {
                            setLoyaltyPointsToUse(0);
                          }
                        }}
                        onCreateCustomer={() => setCreateCustomerDialog(true)}
                        walkInSale={walkInSale}
                        onWalkInToggle={setWalkInSale}
                      />

                      <Separator />
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Panel de Cobro</Label>
                          {paymentMethods.length > 1 && (
                            <Badge variant="secondary">Pago Mixto</Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Método de Pago</Label>
                          <Select value={currentPaymentMethod} onValueChange={setCurrentPaymentMethod}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">💵 Efectivo</SelectItem>
                              <SelectItem value="card">💳 Tarjeta de Crédito</SelectItem>
                              <SelectItem value="transfer">🏦 Transferencia</SelectItem>
                              <SelectItem value="credit">📝 Crédito</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="space-y-2">
                            <Label className="text-xs">Moneda del Pago</Label>
                            <Select value={currentPaymentCurrency} onValueChange={setCurrentPaymentCurrency}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                                <SelectItem value="USD">USD - Dólar</SelectItem>
                                <SelectItem value="EUR">EUR - Euro</SelectItem>
                                <SelectItem value="BRL">BRL - Real</SelectItem>
                                <SelectItem value="UYU">UYU - Peso Uruguayo</SelectItem>
                              </SelectContent>
                            </Select>
                            {currentPaymentCurrency !== 'ARS' && exchangeRates && (
                              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                                {(() => {
                                  const rate = exchangeRates.find(r => r.currency === currentPaymentCurrency);
                                  if (rate) {
                                    const totalInForeign = convertCurrency(restante_base, 'ARS', currentPaymentCurrency);
                                    return (
                                      <>
                                        <div>Cotización: 1 {currentPaymentCurrency} = ${rate.rate.toFixed(2)} ARS</div>
                                        <div className="font-medium mt-1">Total a pagar: {currentPaymentCurrency} {totalInForeign.toFixed(2)}</div>
                                      </>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}
                          </div>
                          
                        {currentPaymentMethod === 'card' && (
                            <div className="space-y-2">
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
                              {currentInstallments > 1 && cardSurchargeRate > 0 && (
                                <Alert className="py-2">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription className="text-xs">
                                    Recargo +{cardSurchargeRate}% por cada cuota ({currentInstallments} cuotas = +{cardSurchargeRate * currentInstallments}%)
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button 
                              type="button" 
                              variant="outline"
                              onClick={payTotalAmount}
                              className="flex-1"
                              disabled={remaining <= 0}
                            >
                              Pagar Total (${(restante_base + potentialCardSurcharge).toFixed(2)})
                            </Button>
                          </div>
                          
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Monto parcial (opcional)"
                              value={currentPaymentAmount}
                              onChange={(e) => setCurrentPaymentAmount(e.target.value)}
                              className="flex-1"
                            />
                            <Button type="button" size="icon" aria-label="Agregar método de pago" onClick={() => addPaymentMethod()}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {paymentMethods.length > 0 && (
                        <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-xs font-semibold">Tramos de Pago Agregados</Label>
                          </div>
                          {paymentMethods.map((pm, index) => {
                            const methodLabel = pm.method === 'cash' ? '💵 Efectivo' : pm.method === 'card' ? '💳 Tarjeta' : '🏦 Transferencia';
                            const installmentInfo = pm.installments && pm.installments > 1 ? ` (${pm.installments} cuotas)` : '';
                            return (
                              <div 
                                key={pm.id} 
                                className="flex items-center justify-between p-2 bg-background rounded border animate-slide-in-right"
                                style={{ animationDelay: `${index * 50}ms` }}
                              >
                                <div className="flex-1">
                                  <div className="text-sm font-medium">
                                    {methodLabel}{installmentInfo}
                                    {pm.currency && pm.currency !== 'ARS' && (
                                      <Badge variant="outline" className="ml-2 text-xs">{pm.currency}</Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Base: ${pm.baseAmount.toFixed(2)} ARS
                                    {pm.surcharge > 0 && ` + Recargo: $${pm.surcharge.toFixed(2)}`}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">${pm.amount.toFixed(2)} ARS</span>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 hover:scale-110 transition-transform" aria-label="Eliminar tramo de pago" onClick={() => removePaymentMethod(pm.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                          <Separator />
                          <div className="space-y-1 animate-fade-in">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Total pagado:</span>
                              <span className="font-medium">${total_cobrado.toFixed(2)} ARS</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Restante:</span>
                              <span className={`font-semibold ${remaining > 0.01 ? "text-destructive" : "text-success"}`}>
                                ${remaining.toFixed(2)} ARS
                              </span>
                            </div>
                            {remaining < -0.01 && (
                              <div className="mt-2 p-2 bg-success/10 rounded border border-success/20">
                                <div className="text-xs font-semibold text-success mb-1">Vuelto a entregar:</div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span>ARS:</span>
                                    <span className="font-medium">${Math.abs(remaining).toFixed(2)}</span>
                                  </div>
                                  {exchangeRates && ['USD', 'EUR', 'BRL'].map(currency => {
                                    const changeInCurrency = convertCurrency(Math.abs(remaining), 'ARS', currency);
                                    const rate = exchangeRates.find(r => r.currency === currency);
                                    if (!rate) return null;
                                    return (
                                      <div key={currency} className="flex justify-between text-xs text-muted-foreground">
                                        <span>{currency}:</span>
                                        <span>{changeInCurrency.toFixed(2)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" onClick={clearCart} className="flex-1 hover:scale-105 transition-transform">
                          Limpiar
                        </Button>
                        <Button 
                          onClick={() => processSaleMutation.mutate()} 
                          disabled={processSaleMutation.isPending || remaining > 0.01} 
                          className="flex-1 hover:scale-105 transition-transform"
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
              <div>
                <Label htmlFor="customer-document">DNI (Opcional)</Label>
                <Input
                  id="customer-document"
                  value={newCustomerDocument}
                  onChange={(e) => setNewCustomerDocument(e.target.value)}
                  placeholder="DNI"
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

        {/* Modal de Opciones de Comprobante */}
        <Dialog open={showReceiptOptions} onOpenChange={setShowReceiptOptions}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                ¡Venta Completada!
              </DialogTitle>
              <DialogDescription>
                ¿Cómo deseas enviar el comprobante al cliente?
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Información de la venta */}
              {lastSaleData && (
                <div className="bg-muted p-4 rounded-lg">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium">Ticket:</span>
                      <span>#{lastSaleData.sale_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Cliente:</span>
                      <span>{lastSaleData.customer?.name || 'Venta Directa'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Total:</span>
                      <span className="font-bold text-lg">${lastSaleData.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Campos opcionales para WhatsApp y Email */}
              <div className="space-y-3">
                {/* Campo para WhatsApp */}
                {!lastSaleData?.customer?.phone && (
                  <div className="space-y-2">
                    <Label htmlFor="temp-phone" className="text-xs font-medium">
                      Número de WhatsApp (Opcional)
                    </Label>
                    <Input
                      id="temp-phone"
                      type="tel"
                      placeholder="+1234567890"
                      value={tempPhoneNumber}
                      onChange={(e) => setTempPhoneNumber(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}

                {/* Campo para Email */}
                {!lastSaleData?.customer?.email && (
                  <div className="space-y-2">
                    <Label htmlFor="temp-email" className="text-xs font-medium">
                      Email (Opcional)
                    </Label>
                    <Input
                      id="temp-email"
                      type="email"
                      placeholder="cliente@email.com"
                      value={tempEmail}
                      onChange={(e) => setTempEmail(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Opciones de envío */}
              <div className="grid grid-cols-1 gap-3">
                <Button
                  onClick={handleWhatsAppReceipt}
                  className="h-12 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Enviar por WhatsApp
                  {lastSaleData?.customer?.phone && (
                    <span className="ml-2 text-xs opacity-75">({lastSaleData.customer.phone})</span>
                  )}
                </Button>

                <Button
                  onClick={handleEmailReceipt}
                  variant="outline"
                  className="h-12"
                >
                  <Mail className="mr-2 h-5 w-5" />
                  Enviar por Email
                  {lastSaleData?.customer?.email && (
                    <span className="ml-2 text-xs opacity-75">({lastSaleData.customer.email})</span>
                  )}
                </Button>

                <Button
                  onClick={handlePrintInvoice}
                  variant="outline"
                  className="h-12"
                >
                  <Printer className="mr-2 h-5 w-5" />
                  Generar Factura PDF (CAE/QR pendiente)
                </Button>

                <Button
                  onClick={handlePrintReceipt}
                  variant="outline"
                  className="h-12"
                >
                  <Printer className="mr-2 h-5 w-5" />
                  Imprimir Ticket
                </Button>

                <Button
                  onClick={handleSkipReceipt}
                  variant="ghost"
                  className="h-10"
                >
                  <X className="mr-2 h-4 w-4" />
                  Omitir
                </Button>
              </div>

              {/* Nota informativa */}
              <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
                💡 <strong>Consejo:</strong> Puedes configurar el diseño de tickets en 
                <span className="font-medium"> Configuración → Diseño de Tickets</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
