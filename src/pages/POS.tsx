import { useState, useRef, useEffect } from "react";
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
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

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
  baseAmount: number;    // Monto base (parte del total_base que cubre)
  surcharge: number;     // Recargo aplicado (solo tarjeta con cuotas > 1)
  amount: number;        // Total del tramo (baseAmount + surcharge)
  installments?: number;
}

export default function POS() {
  const { currentCompany } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState("cash");
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState("");
  const [currentInstallments, setCurrentInstallments] = useState(1);
  const [discountRate, setDiscountRate] = useState(0);
  const [loyaltyPointsToUse, setLoyaltyPointsToUse] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [createCustomerDialog, setCreateCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerDocument, setNewCustomerDocument] = useState("");
  const [showReceiptOptions, setShowReceiptOptions] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [tempPhoneNumber, setTempPhoneNumber] = useState("");
  const [tempEmail, setTempEmail] = useState("");
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [walkInSale, setWalkInSale] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: products, isLoading: isLoadingProducts } = useQuery({
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
        .from("companies")
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

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("active", true)
        .order("is_main", { ascending: false });
      
      if (error) throw error;
      // Auto-select main warehouse
      if (data && data.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(data[0].id);
      }
      return data;
    },
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
    if (currentInstallments > 1) {
      const tasa_recargo = cardSurchargeRate * currentInstallments / 100;
      potentialCardSurcharge = restante_base * tasa_recargo;
    }
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
    
    // Validar que no exceda el restante_base
    if (baseAmount > restante_base + 0.01) {
      toast.error("El monto base excede el restante");
      return;
    }
    
    // Calcular recargo solo si es tarjeta con cuotas > 1
    let surcharge = 0;
    if (currentPaymentMethod === 'card' && currentInstallments > 1) {
      const tasa_recargo = cardSurchargeRate * currentInstallments / 100;
      surcharge = baseAmount * tasa_recargo;
    }
    
    const totalAmount = baseAmount + surcharge;
    
    setPaymentMethods([...paymentMethods, {
      id: Date.now().toString(),
      method: currentPaymentMethod,
      baseAmount: baseAmount,
      surcharge: surcharge,
      amount: totalAmount,
      installments: currentPaymentMethod === 'card' ? currentInstallments : 1
    }]);
    setCurrentPaymentAmount("");
    setCurrentInstallments(1);
    toast.success("Método de pago agregado");
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
          card_surcharge: payment.surcharge,
          installments: payment.installments || 1
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
      toast.error(error.message || "Error al procesar la venta");
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

  return (
    <Layout>
      <div className="container mx-auto p-4 space-y-6">
        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Punto de Venta</h1>
            <p className="text-muted-foreground">Sistema de gestión de ventas</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="px-3 py-1">
              <DollarSign className="mr-1 h-4 w-4" />
              Total: ${total.toFixed(2)}
            </Badge>
            <Badge variant={cart.length > 0 ? "default" : "secondary"} className="px-3 py-1">
              <ShoppingCart className="mr-1 h-4 w-4" />
              {cart.length} items
            </Badge>
          </div>
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de productos */}
          <div className="lg:col-span-2 space-y-4">
            {/* Barra de búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar productos por nombre, código o escanear código de barras..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(sanitizeSearchQuery(e.target.value))}
                className="pl-10"
              />
            </div>

            {/* Grid de productos */}
            {isLoadingProducts ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-6 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-full"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <Card 
                    key={product.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => addToCart(product)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium truncate">
                        {product.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Código: {product.sku || product.barcode || "N/A"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">
                          ${product.price.toFixed(2)}
                        </span>
                      </div>
                      {product.stock === 0 && (
                        <div className="text-center text-xs text-muted-foreground mt-2">
                          Sin stock
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 && !isLoadingProducts && (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  No se encontraron productos. {searchQuery ? 'Intenta con otros términos de búsqueda.' : 'Agrega productos desde el inventario.'}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Panel de carrito y checkout */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito de Compras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cart.map((item, index) => (
                    <div 
                      key={item.product_id} 
                      className="flex items-center justify-between p-3 bg-muted rounded-lg animate-slide-in-right"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">${item.unit_price.toFixed(2)} c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="outline" className="h-7 w-7 hover:scale-110 transition-transform" onClick={() => updateQuantity(item.product_id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7 hover:scale-110 transition-transform" onClick={() => updateQuantity(item.product_id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:scale-110 transition-transform" onClick={() => removeFromCart(item.product_id)}>
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
                      <Label className="text-base font-semibold">Resumen</Label>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Descuento Manual (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={discountRate}
                          onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-1 text-sm p-3 bg-muted/30 rounded-lg animate-fade-in">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">${subtotal.toFixed(2)}</span>
                        </div>
                        {manualDiscountAmount > 0 && (
                          <div className="flex justify-between text-destructive animate-slide-in-right">
                            <span>Descuento Manual ({discountRate}%):</span>
                            <span>-${manualDiscountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {loyaltyDiscountAmount > 0 && (
                          <div className="flex justify-between text-primary animate-slide-in-right">
                            <span>Descuento Fidelidad ({loyaltyDiscountRate}%):</span>
                            <span>-${loyaltyDiscountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {loyaltyPointsValue > 0 && (
                          <div className="flex justify-between text-primary animate-slide-in-right">
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
                        {recargo_pagado > 0 && (
                          <div className="flex justify-between text-warning animate-slide-in-right">
                            <span>Recargo Tarjeta (pagado):</span>
                            <span>+${recargo_pagado.toFixed(2)}</span>
                          </div>
                        )}
                        {potentialCardSurcharge > 0 && (
                          <div className="flex justify-between text-warning animate-pulse-subtle">
                            <span>Recargo Tarjeta Potencial:</span>
                            <span>+${potentialCardSurcharge.toFixed(2)}</span>
                          </div>
                        )}
                        
                        <Separator className="my-2" />
                        
                        <div className="flex justify-between text-base font-bold pt-1 animate-scale-in">
                          <span>Total a Pagar:</span>
                          <span className="text-primary text-lg">${total.toFixed(2)}</span>
                        </div>
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
                            <Button type="button" size="icon" onClick={() => addPaymentMethod()}>
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
                                  <div className="text-sm font-medium">{methodLabel}{installmentInfo}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Base: ${pm.baseAmount.toFixed(2)}
                                    {pm.surcharge > 0 && ` + Recargo: $${pm.surcharge.toFixed(2)}`}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">${pm.amount.toFixed(2)}</span>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 hover:scale-110 transition-transform" onClick={() => removePaymentMethod(pm.id)}>
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
                              <span className="font-medium">${total_cobrado.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Restante:</span>
                              <span className={`font-semibold ${remaining > 0.01 ? "text-destructive" : "text-success"}`}>
                                ${remaining.toFixed(2)}
                              </span>
                            </div>
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
