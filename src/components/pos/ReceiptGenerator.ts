import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

// Función para obtener configuración de ticket
const getTicketConfig = async () => {
  try {
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

    // Fallback a company_settings
    const { data: companyData } = await supabase
      .from('company_settings')
      .select('*')
      .single();
      
    if (companyData) {
      return {
        company_name: companyData.company_name || 'Mi Empresa',
        company_address: companyData.address || '',
        company_phone: companyData.phone || '',
        company_email: companyData.email || '',
        footer_message: companyData.receipt_footer || '¡Gracias por su compra!',
        header_color: '#1f2937',
        text_color: '#374151',
        accent_color: '#3b82f6',
        show_logo: false,
        show_qr: false,
        paper_width: '80mm',
        font_size: 'small',
        logo_url: ''
      };
    }
    
    // Configuración por defecto
    return {
      company_name: 'Mi Empresa',
      company_address: '',
      company_phone: '',
      company_email: '',
      footer_message: '¡Gracias por su compra!',
      header_color: '#1f2937',
      text_color: '#374151',
      accent_color: '#3b82f6',
      show_logo: false,
      show_qr: false,
      paper_width: '80mm',
      font_size: 'small',
      logo_url: ''
    };
  } catch (error) {
    console.warn('Error fetching config:', error);
    return {
      company_name: 'Mi Empresa',
      company_address: '',
      company_phone: '',
      company_email: '',
      footer_message: '¡Gracias por su compra!',
      header_color: '#1f2937',
      text_color: '#374151',
      accent_color: '#3b82f6',
      show_logo: false,
      show_qr: false,
      paper_width: '80mm',
      font_size: 'small',
      logo_url: ''
    };
  }
};

// Generar texto plano para WhatsApp
export const generateWhatsAppReceipt = async (saleData: any) => {
  const config = await getTicketConfig();
  
  const receipt = `
🧾 *${config.company_name.toUpperCase()}*
${config.company_address ? `📍 ${config.company_address}` : ''}
${config.company_phone ? `📞 ${config.company_phone}` : ''}
${config.company_email ? `📧 ${config.company_email}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *COMPROBANTE DE VENTA*

Ticket #: ${saleData.sale_number || 'N/A'}
📅 ${format(new Date(saleData.created_at || new Date()), "dd/MM/yyyy HH:mm", { locale: es })}
👤 Cliente: ${saleData.customer?.name || 'Venta Directa'}
💳 Pago: ${saleData.payment_method === 'cash' ? 'Efectivo' : 
           saleData.payment_method === 'card' ? 'Tarjeta' : 
           saleData.payment_method === 'credit' ? 'Crédito' : saleData.payment_method}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 *PRODUCTOS:*
${saleData.items ? saleData.items.map((item: any) => 
  `• ${item.product?.name || item.name || 'Producto'}
  ${item.quantity} x $${Number(item.unit_price || item.price).toFixed(2)} = $${Number(item.total || item.unit_price * item.quantity).toFixed(2)}`
).join('\n') : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *TOTALES:*
Subtotal: $${Number(saleData.subtotal || saleData.total * 0.9).toFixed(2)}
Impuestos: $${Number(saleData.tax || saleData.total * 0.1).toFixed(2)}
*🎯 TOTAL: $${Number(saleData.total).toFixed(2)}*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${config.footer_message}

${config.show_qr ? '📱 Escanea el código QR para más información' : ''}
  `.trim();

  return receipt;
};

// Generar HTML para email
export const generateEmailReceipt = async (saleData: any) => {
  const config = await getTicketConfig();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comprobante de Venta</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px;
          color: ${config.text_color};
        }
        .header { 
          background-color: ${config.header_color}; 
          color: white; 
          padding: 20px; 
          text-align: center; 
          border-radius: 8px;
        }
        .company-name { font-size: 24px; font-weight: bold; }
        .company-info { font-size: 14px; opacity: 0.9; margin: 5px 0; }
        .content { padding: 20px 0; }
        .section { margin: 20px 0; }
        .section h3 { 
          color: ${config.accent_color}; 
          border-bottom: 2px solid ${config.accent_color}; 
          padding-bottom: 5px; 
        }
        .item { 
          display: flex; 
          justify-content: space-between; 
          padding: 8px 0; 
          border-bottom: 1px solid #eee; 
        }
        .total { 
          font-size: 18px; 
          font-weight: bold; 
          color: ${config.accent_color}; 
          text-align: right; 
          margin-top: 20px; 
        }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #eee; 
          color: #666; 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${config.company_name}</div>
        ${config.company_address ? `<div class="company-info">${config.company_address}</div>` : ''}
        ${config.company_phone ? `<div class="company-info">${config.company_phone}</div>` : ''}
        ${config.company_email ? `<div class="company-info">${config.company_email}</div>` : ''}
      </div>
      
      <div class="content">
        <div class="section">
          <h3>Información de la Venta</h3>
          <p><strong>Ticket #:</strong> ${saleData.sale_number || 'N/A'}</p>
          <p><strong>Fecha:</strong> ${format(new Date(saleData.created_at || new Date()), "dd/MM/yyyy HH:mm", { locale: es })}</p>
          <p><strong>Cliente:</strong> ${saleData.customer?.name || 'Venta Directa'}</p>
          <p><strong>Método de Pago:</strong> ${saleData.payment_method === 'cash' ? 'Efectivo' : 
                                                saleData.payment_method === 'card' ? 'Tarjeta' : 
                                                saleData.payment_method === 'credit' ? 'Crédito' : saleData.payment_method}</p>
        </div>

        <div class="section">
          <h3>Productos</h3>
          ${saleData.items ? saleData.items.map((item: any) => `
            <div class="item">
              <div>
                <strong>${item.product?.name || item.name || 'Producto'}</strong><br>
                <small>${item.quantity} x $${Number(item.unit_price || item.price).toFixed(2)}</small>
              </div>
              <div><strong>$${Number(item.total || item.unit_price * item.quantity).toFixed(2)}</strong></div>
            </div>
          `).join('') : ''}
        </div>

        <div class="section">
          <div class="item">
            <span>Subtotal:</span>
            <span>$${Number(saleData.subtotal || saleData.total * 0.9).toFixed(2)}</span>
          </div>
          <div class="item">
            <span>Impuestos:</span>
            <span>$${Number(saleData.tax || saleData.total * 0.1).toFixed(2)}</span>
          </div>
          <div class="total">
            TOTAL: $${Number(saleData.total).toFixed(2)}
          </div>
        </div>
      </div>

      <div class="footer">
        <p>${config.footer_message}</p>
        <p><small>Este es un comprobante electrónico generado automáticamente.</small></p>
      </div>
    </body>
    </html>
  `;
};
