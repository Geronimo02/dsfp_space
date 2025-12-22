import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface InvoiceItem {
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

interface InvoiceData {
  tipoComprobante: "FACTURA_A" | "FACTURA_B" | "FACTURA_C" | string;
  puntoVenta?: number | string | null;
  numeroComprobante?: string | null; // PPPP-NNNNNNNN si existe, si no PENDIENTE
  cae?: string | null;
  caeVencimiento?: string | null; // ISO date
  fecha?: Date | string | null;
  company?: {
    razon_social?: string | null;
    nombre_fantasia?: string | null;
    cuit?: string | null;
    condicion_iva?: string | null; // responsable_inscripto | monotributista | exento
    address?: string | null;
    phone?: string | null;
  };
  customer?: {
    name?: string | null;
    condicion_iva?: string | null;
    tipo_documento?: string | null;
    numero_documento?: string | null;
  } | null;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  tax_rate?: number;
  total: number;
  paymentMethods?: PaymentMethodItem[];
}

// Utilidades simples
const mapCondicionIVA = (v?: string | null) => {
  if (!v) return "N/D";
  const map: Record<string, string> = {
    responsable_inscripto: "Responsable Inscripto",
    monotributista: "Monotributista",
    exento: "Exento",
    consumidor_final: "Consumidor Final",
  };
  return map[v] || v;
};

const mapTipoDoc = (v?: string | null) => {
  if (!v) return "N/D";
  const map: Record<string, string> = {
    dni: "DNI",
    cuit: "CUIT",
    cuil: "CUIL",
    pasaporte: "Pasaporte",
  };
  return map[v] || v.toUpperCase();
};

const comprobanteLetter = (tipo: string) => {
  if (tipo.endsWith("_A") || tipo === "FACTURA_A") return "A";
  if (tipo.endsWith("_B") || tipo === "FACTURA_B") return "B";
  if (tipo.endsWith("_C") || tipo === "FACTURA_C") return "C";
  return "";
};

export const InvoicePDF = (data: InvoiceData) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // Encabezado: Empresa y tipo
  const razonSocial = data.company?.razon_social || data.company?.nombre_fantasia || "Mi Empresa";
  const cuit = data.company?.cuit || "00-00000000-0";
  const condIVA = mapCondicionIVA(data.company?.condicion_iva || "responsable_inscripto");
  const address = data.company?.address || "";
  const phone = data.company?.phone || "";
  const letra = comprobanteLetter(data.tipoComprobante);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(razonSocial, margin, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (address) { doc.text(address, margin, y); y += 5; }
  if (phone) { doc.text(`Tel: ${phone}`, margin, y); y += 5; }
  doc.text(`CUIT: ${cuit}`, margin, y); y += 5;
  doc.text(`Condición IVA: ${condIVA}`, margin, y); y += 5;

  // Identificación de comprobante (derecha)
  const rightX = pageWidth - margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`Factura ${letra || "(Provisoria)"}`, rightX, margin + 5, { align: "right" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const pv = data.puntoVenta != null ? String(data.puntoVenta).padStart(4, "0") : "0000";
  const nro = data.numeroComprobante || "PENDIENTE";
  doc.text(`P.V.: ${pv}  Nro: ${nro}`, rightX, margin + 13, { align: "right" });
  const f = data.fecha ? new Date(data.fecha) : new Date();
  doc.text(`Fecha: ${format(f, "dd/MM/yyyy HH:mm", { locale: es })}`, rightX, margin + 19, { align: "right" });

  y += 4;
  doc.line(margin, y, rightX, y);
  y += 8;

  // Datos del cliente
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Datos del Cliente", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const clienteNombre = data.customer?.name || "Consumidor Final";
  const clienteIVA = mapCondicionIVA(data.customer?.condicion_iva || "consumidor_final");
  const tdoc = mapTipoDoc(data.customer?.tipo_documento || "dni");
  const ndoc = data.customer?.numero_documento || "N/D";
  doc.text(`Nombre: ${clienteNombre}`, margin, y); y += 5;
  doc.text(`Condición IVA: ${clienteIVA}`, margin, y); y += 5;
  doc.text(`Documento: ${tdoc} ${ndoc}`, margin, y); y += 8;

  // Tabla de items
  doc.setFont("helvetica", "bold");
  doc.text("Detalle", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  // Encabezado de tabla
  const colDesc = margin;
  const colCant = pageWidth - (margin + 70);
  const colUnit = pageWidth - (margin + 40);
  const colImporte = pageWidth - margin;

  doc.setFontSize(10);
  doc.text("Descripción", colDesc, y);
  doc.text("Cant.", colCant, y, { align: "right" });
  doc.text("P.Unit.", colUnit, y, { align: "right" });
  doc.text("Importe", colImporte, y, { align: "right" });
  y += 4;
  doc.line(margin, y, rightX, y);
  y += 5;

  doc.setFontSize(9);
  data.items.forEach((item) => {
    const descLines = doc.splitTextToSize(item.product_name, rightX - margin - 80);
    descLines.forEach((line, idx) => {
      doc.text(line, colDesc, y);
      if (idx === 0) {
        doc.text(String(item.quantity), colCant, y, { align: "right" });
        doc.text(`$${item.unit_price.toFixed(2)}`, colUnit, y, { align: "right" });
        doc.text(`$${item.subtotal.toFixed(2)}`, colImporte, y, { align: "right" });
      }
      y += 5;
    });
  });

  y += 2;
  doc.line(margin, y, rightX, y);
  y += 6;

  // Totales
  const lineHeight = 6;
  const totXLabel = pageWidth - (margin + 45);
  const totXVal = rightX;
  if ((data.discount || 0) > 0) {
    doc.text("Subtotal:", totXLabel, y, { align: "right" });
    doc.text(`$${data.subtotal.toFixed(2)}`, totXVal, y, { align: "right" });
    y += lineHeight;
    doc.text("Descuento:", totXLabel, y, { align: "right" });
    doc.text(`-$${(data.discount || 0).toFixed(2)}`, totXVal, y, { align: "right" });
    y += lineHeight;
  } else {
    doc.text("Subtotal:", totXLabel, y, { align: "right" });
    doc.text(`$${data.subtotal.toFixed(2)}`, totXVal, y, { align: "right" });
    y += lineHeight;
  }

  if ((data.tax || 0) > 0) {
    const tr = data.tax_rate != null ? ` (${data.tax_rate}%)` : "";
    doc.text(`Impuestos${tr}:`, totXLabel, y, { align: "right" });
    doc.text(`$${(data.tax || 0).toFixed(2)}`, totXVal, y, { align: "right" });
    y += lineHeight;
  }

  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", totXLabel, y, { align: "right" });
  doc.text(`$${data.total.toFixed(2)}`, totXVal, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += lineHeight + 2;

  // Desglose de pagos
  if (data.paymentMethods && data.paymentMethods.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Pagos:", margin, y);
    doc.setFont("helvetica", "normal");
    y += 5;
    data.paymentMethods.forEach((pm) => {
      const label = pm.method === "cash" ? "Efectivo" : pm.method === "card" ? "Tarjeta" : pm.method === "transfer" ? "Transferencia" : pm.method;
      const cuotas = pm.installments && pm.installments > 1 ? ` (${pm.installments} cuotas)` : "";
      doc.text(`- ${label}${cuotas}: $${pm.amount.toFixed(2)}`, margin, y);
      y += 5;
    });
    y += 2;
  }

  // CAE y QR AFIP
  doc.line(margin, y, rightX, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Datos AFIP", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  const cae = data.cae || "PENDIENTE";
  const caeVto = data.caeVencimiento ? format(new Date(data.caeVencimiento), "dd/MM/yyyy", { locale: es }) : "--/--/----";
  doc.text(`CAE: ${cae}`, margin, y); y += 5;
  doc.text(`Vencimiento CAE: ${caeVto}`, margin, y); y += 8;

  // Generar código QR AFIP (formato oficial)
  const qrSize = 40;
  const qrX = rightX - qrSize - 5;
  const qrY = y - 20;

  if (data.cae && data.company?.cuit) {
    // Datos para QR AFIP según RG 4291
    const qrData = {
      ver: 1,
      fecha: data.fecha ? format(new Date(data.fecha), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      cuit: (data.company.cuit || "").replace(/-/g, ""),
      ptoVta: parseInt(String(data.puntoVenta || 0)),
      tipoCmp: getTipoComprobanteAFIP(data.tipoComprobante),
      nroCmp: parseInt(String(data.numeroComprobante || "0").split("-").pop() || "0"),
      importe: data.total,
      moneda: "PES",
      ctz: 1,
      tipoDocRec: getTipoDocAFIP(data.customer?.tipo_documento),
      nroDocRec: parseInt((data.customer?.numero_documento || "0").replace(/\D/g, "")) || 0,
      tipoCodAut: "E",
      codAut: parseInt(data.cae),
    };
    
    // Convertir a Base64 URL según spec AFIP
    const qrJson = JSON.stringify(qrData);
    const qrBase64 = btoa(qrJson);
    const qrUrl = `https://www.afip.gob.ar/fe/qr/?p=${qrBase64}`;
    
    // Dibujar marco QR con URL
    doc.setDrawColor(0);
    doc.rect(qrX, qrY, qrSize, qrSize);
    
    // Texto QR placeholder (el QR real necesita librería adicional como qrcode)
    doc.setFontSize(7);
    doc.text("QR AFIP", qrX + qrSize / 2, qrY + 8, { align: "center" });
    doc.setFontSize(5);
    doc.text("Escanear para", qrX + qrSize / 2, qrY + 14, { align: "center" });
    doc.text("verificar en AFIP", qrX + qrSize / 2, qrY + 18, { align: "center" });
    
    // Agregar URL debajo del QR
    doc.setFontSize(4);
    const urlLines = doc.splitTextToSize(qrUrl, qrSize);
    urlLines.forEach((line: string, idx: number) => {
      doc.text(line, qrX + qrSize / 2, qrY + qrSize + 3 + (idx * 2.5), { align: "center" });
    });
    
    y += qrSize - 10;
  } else {
    // Placeholder cuando no hay CAE
    doc.rect(qrX, qrY, qrSize, qrSize);
    doc.setFontSize(8);
    doc.text("QR AFIP", qrX + qrSize / 2, qrY + qrSize / 2, { align: "center" });
    doc.setFontSize(6);
    doc.text("(Pendiente CAE)", qrX + qrSize / 2, qrY + qrSize / 2 + 6, { align: "center" });
    y += qrSize - 10;
  }

  // Nota legal
  y += 12;
  doc.setFontSize(8);
  if (data.cae) {
    doc.text("Comprobante Autorizado - Documento no válido como factura", margin, y);
  } else {
    const nota = `Comprobante generado en modo contingencia/offline. El CAE será asignado al sincronizar con AFIP.`;
    doc.text(nota, margin, y);
  }

  // Guardar
  const safePV = pv || "0000";
  const fileName = `Factura_${letra || "X"}_${safePV}_${nro || "PENDIENTE"}.pdf`;
  doc.save(fileName);
};

// Helpers para códigos AFIP
function getTipoComprobanteAFIP(tipo: string): number {
  const map: Record<string, number> = {
    "FACTURA_A": 1,
    "FACTURA_B": 6,
    "FACTURA_C": 11,
    "NCA": 3,
    "NCB": 8,
    "NCC": 13,
  };
  return map[tipo] || 0;
}

function getTipoDocAFIP(tipo?: string | null): number {
  if (!tipo) return 99; // Sin identificar
  const map: Record<string, number> = {
    "cuit": 80,
    "cuil": 86,
    "dni": 96,
    "pasaporte": 94,
  };
  return map[tipo.toLowerCase()] || 99;
}
