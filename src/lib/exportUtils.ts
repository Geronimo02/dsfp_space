import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToPDF = (
  title: string,
  headers: string[],
  data: any[][],
  filename: string
) => {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  
  // Date
  doc.setFontSize(10);
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 14, 30);
  
  // Table
  (doc as any).autoTable({
    head: [headers],
    body: data,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [71, 85, 105] },
  });
  
  doc.save(`${filename}.pdf`);
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(amount);
};

export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('es-AR');
};
