import jsPDF from "jspdf";

interface QuotationData {
  quotation_number: string;
  customer_name: string;
  created_at: string;
  valid_until?: string;
  subtotal: number;
  discount: number;
  discount_rate: number;
  tax: number;
  total: number;
  notes?: string;
  currency?: string;
  exchange_rate?: number;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  company?: {
    company_name: string;
    address?: string;
    phone?: string;
    email?: string;
    tax_id?: string;
  };
}

export const generateQuotationPDF = async (
  quotation: QuotationData,
  companySettings?: any
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header - Company Info
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(companySettings?.company_name || "Mi Empresa", pageWidth / 2, yPos, { align: "center" });
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (companySettings?.address) {
    doc.text(companySettings.address, pageWidth / 2, yPos, { align: "center" });
    yPos += 5;
  }
  if (companySettings?.phone || companySettings?.email) {
    const contactInfo = [companySettings.phone, companySettings.email].filter(Boolean).join(" | ");
    doc.text(contactInfo, pageWidth / 2, yPos, { align: "center" });
    yPos += 5;
  }
  if (companySettings?.tax_id) {
    doc.text(`CUIT/RUT: ${companySettings.tax_id}`, pageWidth / 2, yPos, { align: "center" });
  }

  yPos += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 10;

  // Document Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PRESUPUESTO", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // Quotation Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Número:", 15, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(quotation.quotation_number, 45, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Fecha:", 15, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(quotation.created_at).toLocaleDateString("es-ES"), 45, yPos);

  if (quotation.valid_until) {
    yPos += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Válido hasta:", 15, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(quotation.valid_until).toLocaleDateString("es-ES"), 45, yPos);
  }

  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 15, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(quotation.customer_name, 45, yPos);

  yPos += 15;

  // Items Table Header
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPos - 5, pageWidth - 30, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Producto", 17, yPos);
  doc.text("Cant.", pageWidth - 80, yPos, { align: "right" });
  doc.text("Precio Unit.", pageWidth - 55, yPos, { align: "right" });
  doc.text("Subtotal", pageWidth - 20, yPos, { align: "right" });

  yPos += 8;
  doc.setFont("helvetica", "normal");

  // Items
  quotation.items.forEach((item) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }

    doc.text(item.product_name.substring(0, 40), 17, yPos);
    doc.text(item.quantity.toString(), pageWidth - 80, yPos, { align: "right" });
    doc.text(`$${item.unit_price.toFixed(2)}`, pageWidth - 55, yPos, { align: "right" });
    doc.text(`$${item.subtotal.toFixed(2)}`, pageWidth - 20, yPos, { align: "right" });
    yPos += 6;
  });

  yPos += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 8;

  // Totals
  const currency = quotation.currency || "ARS";
  const currencySymbol = currency === "USD" ? "US$" : currency === "EUR" ? "€" : "$";
  
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", pageWidth - 60, yPos);
  doc.text(`${currencySymbol}${quotation.subtotal.toFixed(2)}`, pageWidth - 20, yPos, { align: "right" });

  if (quotation.discount > 0) {
    yPos += 6;
    doc.text(`Descuento (${quotation.discount_rate}%):`, pageWidth - 60, yPos);
    doc.text(`-${currencySymbol}${quotation.discount.toFixed(2)}`, pageWidth - 20, yPos, { align: "right" });
  }

  if (quotation.tax > 0) {
    yPos += 6;
    doc.text("Impuestos:", pageWidth - 60, yPos);
    doc.text(`${currencySymbol}${quotation.tax.toFixed(2)}`, pageWidth - 20, yPos, { align: "right" });
  }

  yPos += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`TOTAL (${currency}):`, pageWidth - 60, yPos);
  doc.text(`${currencySymbol}${quotation.total.toFixed(2)}`, pageWidth - 20, yPos, { align: "right" });
  
  // Si hay tipo de cambio, mostrar equivalencia en ARS
  if (currency !== "ARS" && quotation.exchange_rate) {
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const totalARS = quotation.total * quotation.exchange_rate;
    doc.text(`(Equivalente: $${totalARS.toFixed(2)} ARS - TC: ${quotation.exchange_rate})`, pageWidth - 20, yPos, { align: "right" });
    doc.setTextColor(0);
  }

  // Notes
  if (quotation.notes) {
    yPos += 15;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 15, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const splitNotes = doc.splitTextToSize(quotation.notes, pageWidth - 30);
    doc.text(splitNotes, 15, yPos);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save PDF
  doc.save(`Presupuesto-${quotation.quotation_number}.pdf`);
};
