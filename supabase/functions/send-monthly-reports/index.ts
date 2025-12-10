import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MonthlyReportRequest {
  companyId: string;
  month: string; // YYYY-MM format
  recipientEmail: string;
  recipientName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create client with user's JWT for authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado - Token no proporcionado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "No autorizado - Token inválido" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { companyId, month, recipientEmail, recipientName }: MonthlyReportRequest = await req.json();

    // Verify user belongs to the requested company with admin or manager role
    const { data: companyUser, error: companyError } = await supabaseClient
      .from("company_users")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .eq("active", true)
      .single();

    if (companyError || !companyUser) {
      console.error("Company access error:", companyError);
      return new Response(
        JSON.stringify({ error: "No autorizado - No tiene acceso a esta empresa" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Only admin and manager roles can send reports
    const allowedRoles = ["admin", "manager"];
    if (!allowedRoles.includes(companyUser.role)) {
      return new Response(
        JSON.stringify({ error: "No autorizado - Se requiere rol de administrador o gerente" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Usuario ${user.id} (${companyUser.role}) generando reporte para empresa ${companyId}`);

    // Use admin client for data access after authorization is verified
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`Generando reporte mensual para ${month} - Empresa: ${companyId}`);

    // Parse month
    const [year, monthNum] = month.split("-");
    const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);

    // Fetch company details
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name, tax_id, razon_social")
      .eq("id", companyId)
      .single();

    // Fetch sales data
    const { data: salesData } = await supabaseAdmin
      .from("sales")
      .select(`
        *,
        sale_items(*),
        customers(name, document, tipo_documento, condicion_iva)
      `)
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at");

    // Fetch purchases data
    const { data: purchasesData } = await supabaseAdmin
      .from("purchases")
      .select(`
        *,
        purchase_items(*),
        suppliers(name, tax_id)
      `)
      .eq("company_id", companyId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at");

    // Fetch AFIP invoices
    const { data: afipData } = await supabaseAdmin
      .from("comprobantes_afip")
      .select("*")
      .eq("company_id", companyId)
      .gte("fecha_emision", startDate.toISOString())
      .lte("fecha_emision", endDate.toISOString())
      .order("fecha_emision");

    // Generate CSV files
    const salesCSV = generateSalesCSV(salesData || []);
    const purchasesCSV = generatePurchasesCSV(purchasesData || []);
    const ivaVentasCSV = generateIVAVentasCSV(salesData || [], afipData || []);
    const ivaComprasCSV = generateIVAComprasCSV(purchasesData || []);
    const resumenCSV = generateResumenCSV(salesData || [], purchasesData || []);

    // Create email with attachments
    const monthName = startDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    
    const emailResponse = await resend.emails.send({
      from: "Sistema Contable <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `Reportes Contables - ${company?.name || "Empresa"} - ${monthName}`,
      html: `
        <h1>Reportes Contables Mensuales</h1>
        <p>Hola ${recipientName || ""},</p>
        <p>Adjuntamos los reportes contables del mes de <strong>${monthName}</strong> para <strong>${company?.razon_social || company?.name}</strong>.</p>
        
        <h2>Archivos incluidos:</h2>
        <ul>
          <li><strong>libro_iva_ventas.csv</strong> - Libro IVA Ventas</li>
          <li><strong>libro_iva_compras.csv</strong> - Libro IVA Compras</li>
          <li><strong>registro_ventas.csv</strong> - Detalle de Ventas</li>
          <li><strong>registro_compras.csv</strong> - Detalle de Compras</li>
          <li><strong>resumen_mensual.csv</strong> - Resumen del Período</li>
        </ul>
        
        <h3>Resumen del mes:</h3>
        <ul>
          <li>Total Ventas: ${salesData?.length || 0} operaciones</li>
          <li>Total Compras: ${purchasesData?.length || 0} operaciones</li>
          <li>Comprobantes AFIP: ${afipData?.length || 0}</li>
        </ul>
        
        <p>Saludos,<br/>Sistema de Gestión</p>
      `,
      attachments: [
        {
          filename: "libro_iva_ventas.csv",
          content: btoa(ivaVentasCSV),
        },
        {
          filename: "libro_iva_compras.csv",
          content: btoa(ivaComprasCSV),
        },
        {
          filename: "registro_ventas.csv",
          content: btoa(salesCSV),
        },
        {
          filename: "registro_compras.csv",
          content: btoa(purchasesCSV),
        },
        {
          filename: "resumen_mensual.csv",
          content: btoa(resumenCSV),
        },
      ],
    });

    console.log("Email enviado exitosamente:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Reportes enviados exitosamente",
        emailId: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error al enviar reportes:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateSalesCSV(sales: any[]): string {
  const headers = [
    "Fecha",
    "Número",
    "Cliente",
    "Documento",
    "Cond. IVA",
    "Subtotal",
    "IVA",
    "Total",
    "Forma Pago",
    "Estado"
  ];
  
  const rows = sales.map(sale => [
    new Date(sale.created_at).toLocaleDateString("es-AR"),
    sale.sale_number,
    sale.customers?.name || "Consumidor Final",
    sale.customers?.document || "-",
    sale.customers?.condicion_iva || "consumidor_final",
    sale.subtotal?.toFixed(2) || "0.00",
    ((sale.total || 0) - (sale.subtotal || 0)).toFixed(2),
    sale.total?.toFixed(2) || "0.00",
    sale.payment_method,
    sale.status
  ]);
  
  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

function generatePurchasesCSV(purchases: any[]): string {
  const headers = [
    "Fecha",
    "Número",
    "Proveedor",
    "CUIT",
    "Subtotal",
    "IVA",
    "Total",
    "Estado Pago"
  ];
  
  const rows = purchases.map(purchase => [
    new Date(purchase.purchase_date).toLocaleDateString("es-AR"),
    purchase.purchase_number,
    purchase.suppliers?.name || "-",
    purchase.suppliers?.tax_id || "-",
    purchase.subtotal?.toFixed(2) || "0.00",
    (purchase.tax || 0).toFixed(2),
    purchase.total?.toFixed(2) || "0.00",
    purchase.payment_status
  ]);
  
  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

function generateIVAVentasCSV(sales: any[], afipData: any[]): string {
  const headers = [
    "Fecha",
    "Tipo Comp.",
    "Punto Venta",
    "Número",
    "Cliente",
    "CUIT/DNI",
    "Neto Gravado",
    "IVA 21%",
    "Total"
  ];
  
  const rows = sales.map(sale => {
    const afip = afipData.find(a => a.sale_id === sale.id);
    const iva = (sale.total || 0) - (sale.subtotal || 0);
    
    return [
      new Date(sale.created_at).toLocaleDateString("es-AR"),
      afip?.tipo_comprobante || "TICKET",
      afip?.punto_venta || "-",
      afip?.numero_comprobante || sale.sale_number,
      sale.customers?.name || "Consumidor Final",
      sale.customers?.document || "-",
      (sale.subtotal || 0).toFixed(2),
      iva.toFixed(2),
      (sale.total || 0).toFixed(2)
    ];
  });
  
  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

function generateIVAComprasCSV(purchases: any[]): string {
  const headers = [
    "Fecha",
    "Tipo Comp.",
    "Número",
    "Proveedor",
    "CUIT",
    "Neto Gravado",
    "IVA",
    "Total"
  ];
  
  const rows = purchases.map(purchase => [
    new Date(purchase.purchase_date).toLocaleDateString("es-AR"),
    "FACTURA",
    purchase.purchase_number,
    purchase.suppliers?.name || "-",
    purchase.suppliers?.tax_id || "-",
    (purchase.subtotal || 0).toFixed(2),
    (purchase.tax || 0).toFixed(2),
    (purchase.total || 0).toFixed(2)
  ]);
  
  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

function generateResumenCSV(sales: any[], purchases: any[]): string {
  const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
  const salesIVA = sales.reduce((sum, s) => sum + ((s.total || 0) - (s.subtotal || 0)), 0);
  const purchasesIVA = purchases.reduce((sum, p) => sum + (p.tax || 0), 0);
  
  const data = [
    ["Concepto", "Cantidad", "Monto Total", "IVA"],
    ["Ventas", sales.length.toString(), totalSales.toFixed(2), salesIVA.toFixed(2)],
    ["Compras", purchases.length.toString(), totalPurchases.toFixed(2), purchasesIVA.toFixed(2)],
    ["", "", "", ""],
    ["IVA a Pagar/Favor", "", "", (salesIVA - purchasesIVA).toFixed(2)],
    ["Resultado", "", "", (totalSales - totalPurchases).toFixed(2)]
  ];
  
  return data.map(row => row.join(",")).join("\n");
}

Deno.serve(handler);
