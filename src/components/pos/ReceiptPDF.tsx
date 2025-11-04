import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PaymentMethodItem {
  method: string;
  amount: number;
  installments?: number;
}

interface ReceiptData {
  saleNumber?: string;
  sale_number?: string;
  items: ReceiptItem[];
  sale_items?: ReceiptItem[];
  subtotal: number;
  discount: number;
  discount_rate?: number;
  tax: number;
  tax_rate?: number;
  cardSurcharge?: number;
  total: number;
  paymentMethod?: string;
  payment_method?: string;
  paymentMethods?: PaymentMethodItem[];
  installments?: number;
  installmentAmount?: number;
  installment_amount?: number;
  cardSurchargeRate?: number;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  footer?: string;
  customer?: any;
}

export const ReceiptPDF = (data: ReceiptData) => {
  const items = data.items || data.sale_items || [];
  const saleNumber = data.saleNumber || data.sale_number || "";
  const paymentMethod = data.paymentMethod || data.payment_method || "cash";
  const installmentAmount = data.installmentAmount || data.installment_amount || 0;

  generateReceiptPDF({
    saleNumber,
    items,
    subtotal: data.subtotal,
    discount: data.discount,
    tax: data.tax,
    cardSurcharge: data.cardSurcharge,
    total: data.total,
    paymentMethod,
    paymentMethods: data.paymentMethods,
    installments: data.installments,
    installmentAmount,
    cardSurchargeRate: data.cardSurchargeRate,
    customer: data.customer,
    companyName: data.companyName || "Mi Negocio",
    companyAddress: data.companyAddress,
    companyPhone: data.companyPhone,
    companyTaxId: data.companyTaxId,
    footer: data.footer,
  });
};

export const generateReceiptPDF = (data: {
  saleNumber: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  cardSurcharge?: number;
  total: number;
  paymentMethod?: string;
  paymentMethods?: PaymentMethodItem[];
  installments?: number;
  installmentAmount?: number;
  cardSurchargeRate?: number;
  customer?: any;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  footer?: string;
}) => {
  const doc = new jsPDF({
    unit: "mm",
    format: [80, 200], // Formato ticket térmico
  });

  let y = 10;
  const leftMargin = 5;
  const pageWidth = 80;

  // Company header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName, pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (data.companyTaxId) {
    doc.text(`Tax ID: ${data.companyTaxId}`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }
  if (data.companyAddress) {
    doc.text(data.companyAddress, pageWidth / 2, y, { align: "center" });
    y += 4;
  }
  if (data.companyPhone) {
    doc.text(`Tel: ${data.companyPhone}`, pageWidth / 2, y, { align: "center" });
    y += 4;
  }

  // Line separator
  y += 2;
  doc.line(leftMargin, y, pageWidth - leftMargin, y);
  y += 4;

  // Sale info
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`TICKET: ${data.saleNumber}`, leftMargin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, leftMargin, y);
  y += 5;
  
  // Customer info if available
  if (data.customer) {
    doc.setFont("helvetica", "bold");
    doc.text(`Cliente:`, leftMargin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text(data.customer.name, leftMargin, y);
    y += 4;
    if (data.customer.document) {
      doc.text(`DNI: ${data.customer.document}`, leftMargin, y);
      y += 4;
    }
    y += 1;
  }

  // Line separator
  doc.line(leftMargin, y, pageWidth - leftMargin, y);
  y += 4;

  // Items header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Producto", leftMargin, y);
  doc.text("Cant", pageWidth - 35, y);
  doc.text("Precio", pageWidth - 25, y);
  doc.text("Total", pageWidth - 15, y, { align: "right" });
  y += 4;
  doc.line(leftMargin, y, pageWidth - leftMargin, y);
  y += 4;

  // Items
  doc.setFont("helvetica", "normal");
  data.items.forEach((item) => {
    const lines = doc.splitTextToSize(item.product_name, 35);
    lines.forEach((line: string, index: number) => {
      doc.text(line, leftMargin, y);
      if (index === 0) {
        doc.text(item.quantity.toString(), pageWidth - 35, y);
        doc.text(`$${item.unit_price.toFixed(2)}`, pageWidth - 25, y);
        doc.text(`$${item.subtotal.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
      }
      y += 4;
    });
  });

  // Line separator
  y += 1;
  doc.line(leftMargin, y, pageWidth - leftMargin, y);
  y += 4;

  // Totals
  doc.setFontSize(9);
  doc.text("Subtotal:", leftMargin, y);
  doc.text(`$${data.subtotal.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
  y += 5;

  if (data.discount > 0) {
    doc.text("Descuento:", leftMargin, y);
    doc.text(`-$${data.discount.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
    y += 5;
  }

  if (data.tax > 0) {
    doc.text("Impuesto:", leftMargin, y);
    doc.text(`$${data.tax.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
    y += 5;
  }

  if (data.cardSurcharge && data.cardSurcharge > 0) {
    doc.text("Recargo Financiación:", leftMargin, y);
    doc.text(`$${data.cardSurcharge.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
    y += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL:", leftMargin, y);
  doc.text(`$${data.total.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
  y += 6;

  // Payment methods breakdown
  if (data.paymentMethods && data.paymentMethods.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("DESGLOSE DE PAGOS:", leftMargin, y);
    y += 5;
    doc.line(leftMargin, y, pageWidth - leftMargin, y);
    y += 4;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    data.paymentMethods.forEach((pm) => {
      const methodName = getPaymentMethodLabel(pm.method);
      doc.text(`${methodName}:`, leftMargin, y);
      doc.text(`$${pm.amount.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
      y += 4;
      
      if (pm.method === 'card' && pm.installments && pm.installments > 1) {
        const surchargeForThisPayment = (pm.amount * (data.cardSurchargeRate || 0) * pm.installments / 100);
        const totalWithSurcharge = pm.amount + surchargeForThisPayment;
        const installmentAmount = totalWithSurcharge / pm.installments;
        doc.setFontSize(7);
        doc.text(`  Plan: ${pm.installments} cuotas de $${installmentAmount.toFixed(2)}`, leftMargin, y);
        y += 3;
        doc.text(`  Recargo: +${(data.cardSurchargeRate || 0) * pm.installments}% ($${surchargeForThisPayment.toFixed(2)})`, leftMargin, y);
        y += 4;
        doc.setFontSize(8);
      }
    });
    y += 2;
  } else if (data.installments && data.installments > 1) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Plan: ${data.installments} cuotas de $${data.installmentAmount?.toFixed(2)}`, leftMargin, y);
    y += 5;
  }

  // Footer
  if (data.footer) {
    y += 5;
    doc.line(leftMargin, y, pageWidth - leftMargin, y);
    y += 4;
    doc.setFontSize(7);
    const footerLines = doc.splitTextToSize(data.footer, pageWidth - 10);
    footerLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, y, { align: "center" });
      y += 3;
    });
  }

  // Save PDF
  doc.save(`ticket-${data.saleNumber}.pdf`);
};

const getPaymentMethodLabel = (method: string) => {
  const labels: { [key: string]: string } = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
  };
  return labels[method] || method;
};
