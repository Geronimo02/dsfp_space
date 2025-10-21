import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface ReceiptData {
  saleNumber: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  installments?: number;
  installmentAmount?: number;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyTaxId?: string;
  footer?: string;
}

export const generateReceiptPDF = (data: ReceiptData) => {
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
  doc.text(`Pago: ${getPaymentMethodLabel(data.paymentMethod)}`, leftMargin, y);
  y += 3;

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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL:", leftMargin, y);
  doc.text(`$${data.total.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
  y += 6;

  if (data.installments && data.installments > 1) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${data.installments} cuotas de $${data.installmentAmount?.toFixed(2)}`, leftMargin, y);
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
