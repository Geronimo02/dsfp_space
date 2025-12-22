import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PayrollReceiptPDFProps {
  liquidation: {
    id: string;
    period_month: number;
    period_year: number;
    base_salary: number;
    total_remunerative: number;
    total_non_remunerative: number;
    total_deductions: number;
    net_salary: number;
    worked_days?: number;
    absent_days?: number;
    employees?: {
      first_name: string;
      last_name: string;
      document_number?: string;
      position?: string;
      hire_date?: string;
    };
  };
  company: {
    name: string;
    cuit?: string;
    address?: string;
  };
}

export const PayrollReceiptPDF = ({ liquidation, company }: PayrollReceiptPDFProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const generatePDF = () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("RECIBO DE SUELDO", pageWidth / 2, 20, { align: "center" });

      // Company info
      doc.setFontSize(12);
      doc.text(company.name, pageWidth / 2, 30, { align: "center" });
      if (company.cuit) {
        doc.setFontSize(10);
        doc.text(`CUIT: ${company.cuit}`, pageWidth / 2, 36, { align: "center" });
      }
      if (company.address) {
        doc.text(company.address, pageWidth / 2, 42, { align: "center" });
      }

      // Period
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const periodText = `Período: ${monthNames[liquidation.period_month - 1]} ${liquidation.period_year}`;
      doc.text(periodText, pageWidth / 2, 52, { align: "center" });

      // Employee info
      doc.setFontSize(10);
      const employee = liquidation.employees;
      const employeeName = employee ? `${employee.first_name} ${employee.last_name}` : "N/A";
      
      const employeeInfo = [
        ["Empleado:", employeeName],
        ["Documento:", employee?.document_number || "N/A"],
        ["Cargo:", employee?.position || "N/A"],
        ["Fecha Ingreso:", employee?.hire_date ? format(new Date(employee.hire_date), "dd/MM/yyyy") : "N/A"],
      ];

      doc.setFont("helvetica", "bold");
      doc.text("DATOS DEL EMPLEADO", 14, 65);
      doc.setFont("helvetica", "normal");

      let yPos = 72;
      employeeInfo.forEach(([label, value]) => {
        doc.text(`${label}`, 14, yPos);
        doc.text(`${value}`, 60, yPos);
        yPos += 6;
      });

      // Haberes (Earnings)
      doc.setFont("helvetica", "bold");
      doc.text("HABERES", 14, yPos + 10);

      const haberesData = [
        ["Sueldo Básico", `$${liquidation.base_salary.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
        ["Total Remunerativo", `$${liquidation.total_remunerative.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
        ["Total No Remunerativo", `$${(liquidation.total_non_remunerative || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
      ];

      autoTable(doc, {
        startY: yPos + 15,
        head: [["Concepto", "Importe"]],
        body: haberesData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
        tableWidth: (pageWidth - 28) / 2 - 5,
      });

      // Deducciones (Deductions)
      const deduccionesY = yPos + 10;
      doc.text("DEDUCCIONES", pageWidth / 2 + 5, deduccionesY);

      const deduccionesData = [
        ["Jubilación (11%)", `$${(liquidation.total_remunerative * 0.11).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
        ["Obra Social (3%)", `$${(liquidation.total_remunerative * 0.03).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
        ["PAMI (3%)", `$${(liquidation.total_remunerative * 0.03).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
        ["Total Deducciones", `$${liquidation.total_deductions.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`],
      ];

      autoTable(doc, {
        startY: yPos + 15,
        head: [["Concepto", "Importe"]],
        body: deduccionesData,
        theme: "striped",
        headStyles: { fillColor: [239, 68, 68] },
        margin: { left: pageWidth / 2 + 5, right: 14 },
        tableWidth: (pageWidth - 28) / 2 - 5,
      });

      // Net Salary
      const finalY = Math.max(
        (doc as any).lastAutoTable?.finalY || 150,
        150
      );

      doc.setFillColor(34, 197, 94);
      doc.rect(14, finalY + 10, pageWidth - 28, 15, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("SUELDO NETO A COBRAR:", 20, finalY + 20);
      doc.text(
        `$${liquidation.net_salary.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
        pageWidth - 20,
        finalY + 20,
        { align: "right" }
      );

      // Signatures
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const signY = finalY + 50;
      doc.line(20, signY, 80, signY);
      doc.line(pageWidth - 80, signY, pageWidth - 20, signY);
      doc.text("Firma Empleador", 50, signY + 5, { align: "center" });
      doc.text("Firma Empleado", pageWidth - 50, signY + 5, { align: "center" });

      // Footer
      doc.setFontSize(8);
      doc.text(
        `Generado el ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );

      // Save
      const fileName = `recibo_${employeeName.replace(/\s/g, "_")}_${liquidation.period_month}_${liquidation.period_year}.pdf`;
      doc.save(fileName);

      toast.success("Recibo generado exitosamente");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar el recibo");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={generatePDF}
      disabled={isGenerating}
    >
      {isGenerating ? (
        <>Generando...</>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-1" />
          Recibo PDF
        </>
      )}
    </Button>
  );
};
