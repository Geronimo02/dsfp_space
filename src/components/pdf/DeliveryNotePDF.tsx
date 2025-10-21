import jsPDF from "jspdf";

interface DeliveryNoteData {
  delivery_number: string;
  customer_name: string;
  delivery_address?: string;
  created_at: string;
  delivery_date?: string;
  received_by?: string;
  received_at?: string;
  subtotal: number;
  total: number;
  notes?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

export const generateDeliveryNotePDF = async (
  deliveryNote: DeliveryNoteData,
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
  doc.text("REMITO", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // Delivery Note Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Número:", 15, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(deliveryNote.delivery_number, 45, yPos);
  
  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Fecha emisión:", 15, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(deliveryNote.created_at).toLocaleDateString("es-ES"), 45, yPos);

  if (deliveryNote.delivery_date) {
    yPos += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Fecha entrega:", 15, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(deliveryNote.delivery_date).toLocaleDateString("es-ES"), 45, yPos);
  }

  yPos += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 15, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(deliveryNote.customer_name, 45, yPos);

  if (deliveryNote.delivery_address) {
    yPos += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Dirección:", 15, yPos);
    doc.setFont("helvetica", "normal");
    const splitAddress = doc.splitTextToSize(deliveryNote.delivery_address, pageWidth - 50);
    doc.text(splitAddress, 45, yPos);
    yPos += splitAddress.length * 5;
  }

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
  deliveryNote.items.forEach((item) => {
    if (yPos > 240) {
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

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL:", pageWidth - 60, yPos);
  doc.text(`$${deliveryNote.total.toFixed(2)}`, pageWidth - 20, yPos, { align: "right" });

  // Notes
  if (deliveryNote.notes) {
    yPos += 15;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 15, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const splitNotes = doc.splitTextToSize(deliveryNote.notes, pageWidth - 30);
    doc.text(splitNotes, 15, yPos);
    yPos += splitNotes.length * 5;
  }

  // Signature Section
  yPos += 20;
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  
  // Signature boxes
  const boxY = yPos;
  const box1X = 20;
  const box2X = pageWidth - 80;
  const boxWidth = 60;
  const boxHeight = 30;

  // Box 1 - Receiver
  doc.rect(box1X, boxY, boxWidth, boxHeight);
  doc.text("Recibido por:", box1X + 2, boxY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (deliveryNote.received_by) {
    doc.text(deliveryNote.received_by, box1X + 2, boxY + 12);
  }
  if (deliveryNote.received_at) {
    doc.text(
      new Date(deliveryNote.received_at).toLocaleString("es-ES"),
      box1X + 2,
      boxY + boxHeight - 3
    );
  }

  // Box 2 - Deliverer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.rect(box2X, boxY, boxWidth, boxHeight);
  doc.text("Entregado por:", box2X + 2, boxY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Firma:", box2X + 2, boxY + boxHeight - 3);

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
  doc.save(`Remito-${deliveryNote.delivery_number}.pdf`);
};
