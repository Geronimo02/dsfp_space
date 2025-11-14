import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

// Función para obtener configuración de ticket
const getTicketConfig = async () => {
  try {
    // Primero intentar obtener de ticket_config usando consulta directa
    const { data: ticketConfig, error: ticketError } = await supabase
      .from('ticket_config' as any)
      .select('*')
      .single();
      
    if (!ticketError && ticketConfig) {
      return {
        company_name: (ticketConfig as any).company_name || 'Mi Empresa',
        company_address: (ticketConfig as any).company_address || '',
        company_phone: (ticketConfig as any).company_phone || '',
        company_email: (ticketConfig as any).company_email || '',
        footer_message: (ticketConfig as any).footer_message || '¡Gracias por su compra!',
        header_color: (ticketConfig as any).header_color || '#1f2937',
        text_color: (ticketConfig as any).text_color || '#374151',
        accent_color: (ticketConfig as any).accent_color || '#3b82f6',
        show_logo: (ticketConfig as any).show_logo !== false,
        show_qr: (ticketConfig as any).show_qr !== false,
        paper_width: (ticketConfig as any).paper_width || '80mm',
        font_size: (ticketConfig as any).font_size || 'small',
        logo_url: (ticketConfig as any).logo_url || ''
      };
    }

    // Si no existe ticket_config, usar companies como fallback
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .single();
      
    if (!companyError && companyData) {
      return {
        company_name: companyData.name || 'Mi Empresa',
        company_address: companyData.address || '',
        company_phone: companyData.phone || '',
        company_email: companyData.email || '',
        footer_message: companyData.receipt_footer || '¡Gracias por su compra!',
        header_color: '#1f2937',
        text_color: '#374151',
        accent_color: '#3b82f6',
        show_logo: true,
        show_qr: true,
        paper_width: '80mm',
        font_size: 'small',
        logo_url: ''
      };
    }
    
    // Configuración por defecto si no hay datos
    return {
      company_name: 'Mi Empresa',
      company_address: '',
      company_phone: '',
      company_email: '',
      footer_message: '¡Gracias por su compra!',
      header_color: '#1f2937',
      text_color: '#374151',
      accent_color: '#3b82f6',
      show_logo: true,
      show_qr: true,
      paper_width: '80mm',
      font_size: 'small',
      logo_url: ''
    };
  } catch (error) {
    console.warn('Error fetching ticket config:', error);
    return {
      company_name: 'Mi Empresa',
      company_address: '',
      company_phone: '',
      company_email: '',
      footer_message: '¡Gracias por su compra!',
      header_color: '#1f2937',
      text_color: '#374151',
      accent_color: '#3b82f6',
      show_logo: true,
      show_qr: true,
      paper_width: '80mm',
      font_size: 'small',
      logo_url: ''
    };
  }
};

export const ReceiptPDF = async (saleData: any) => {
  const config = await getTicketConfig();
  
  // Crear el contenido HTML del ticket
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Courier New', monospace;
          font-size: ${config.font_size === 'large' ? '14px' : 
                      config.font_size === 'medium' ? '12px' : '10px'};
          color: ${config.text_color};
          margin: 0;
          padding: 10px;
          width: ${config.paper_width === 'A4' ? '210mm' : config.paper_width};
        }
        .header {
          text-align: center;
          background-color: ${config.header_color};
          color: white;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 15px;
        }
        .company-name {
          font-size: 1.2em;
          font-weight: bold;
          margin: 5px 0;
        }
        .company-info {
          font-size: 0.9em;
          margin: 2px 0;
          opacity: 0.9;
        }
        .sale-info {
          margin-bottom: 10px;
          font-size: 0.9em;
        }
        .items {
          margin: 10px 0;
        }
        .item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .totals {
          border-top: 1px solid #000;
          margin-top: 10px;
          padding-top: 5px;
        }
        .total-line {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        .grand-total {
          font-weight: bold;
          color: ${config.accent_color};
          font-size: 1.1em;
          border-top: 1px solid #000;
          padding-top: 5px;
          margin-top: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 15px;
          font-size: 0.9em;
        }
        .qr-code {
          margin: 10px auto;
          text-align: center;
        }
        hr {
          border: none;
          border-top: 1px dashed #000;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <!-- Encabezado -->
      <div class="header" style="background-color: ${config.header_color}; color: white; padding: 10px; border-radius: 4px; margin-bottom: 15px; text-align: center;">
        ${config.show_logo && config.logo_url ? `
          <div style="margin-bottom: 10px;">
            <img src="${config.logo_url}" alt="Logo" style="max-width: 80px; max-height: 60px; object-fit: contain;" />
          </div>
        ` : config.show_logo ? `
          <div style="margin-bottom: 5px;">
            <div style="width: 60px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 4px; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 10px;">
              LOGO
            </div>
          </div>
        ` : ''}
        <div class="company-name" style="font-size: 1.2em; font-weight: bold; margin: 5px 0;">${config.company_name}</div>
        ${config.company_address ? `<div class="company-info" style="font-size: 0.9em; margin: 2px 0; opacity: 0.9;">${config.company_address}</div>` : ''}
        ${config.company_phone ? `<div class="company-info" style="font-size: 0.9em; margin: 2px 0; opacity: 0.9;">${config.company_phone}</div>` : ''}
        ${config.company_email ? `<div class="company-info" style="font-size: 0.9em; margin: 2px 0; opacity: 0.9;">${config.company_email}</div>` : ''}
      </div>

      <!-- Información de la venta -->
      <div class="sale-info">
        <div class="total-line">
          <span>Ticket #:</span>
          <span>${saleData.sale_number || 'N/A'}</span>
        </div>
        <div class="total-line">
          <span>Fecha:</span>
          <span>${format(new Date(saleData.created_at || new Date()), "dd/MM/yyyy HH:mm", { locale: es })}</span>
        </div>
        <div class="total-line">
          <span>Cajero:</span>
          <span>Administrador</span>
        </div>
        ${saleData.customer ? `
        <div class="total-line">
          <span>Cliente:</span>
          <span>${saleData.customer.name}</span>
        </div>
        ` : ''}
      </div>

      <hr>

      <!-- Productos -->
      <div class="items">
        ${saleData.items ? saleData.items.map((item: any) => `
          <div class="item">
            <span>${item.product?.name || item.name || 'Producto'}</span>
            <span>$${Number(item.total || item.price * item.quantity).toFixed(2)}</span>
          </div>
          <div style="font-size: 0.8em; color: #666; margin-left: 10px;">
            ${item.quantity} x $${Number(item.price).toFixed(2)}
          </div>
        `).join('') : ''}
      </div>

      <hr>

      <!-- Totales -->
      <div class="totals">
        <div class="total-line">
          <span>Subtotal:</span>
          <span>$${Number(saleData.subtotal || saleData.total * 0.9).toFixed(2)}</span>
        </div>
        <div class="total-line">
          <span>Impuestos:</span>
          <span>$${Number(saleData.tax || saleData.total * 0.1).toFixed(2)}</span>
        </div>
        <div class="total-line grand-total">
          <span>TOTAL:</span>
          <span>$${Number(saleData.total).toFixed(2)}</span>
        </div>
      </div>

      <hr>

      <!-- Pie -->
      <div class="footer">
        <div>${config.footer_message}</div>
        ${config.show_qr ? `
        <div class="qr-code">
          <div style="width: 50px; height: 50px; border: 1px solid #000; margin: 10px auto; display: flex; align-items: center; justify-content: center;">
            QR
          </div>
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;

  // Abrir ventana de impresión
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
};