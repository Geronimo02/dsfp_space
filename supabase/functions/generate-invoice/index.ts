// supabase/functions/generate-invoice/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateInvoicePDF(invoiceData: any, company: any): Promise<string> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Header
  doc.setFontSize(24);
  doc.text("INVOICE", 20, 30);

  // Invoice Number & Date
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoiceData.invoice_number}`, 20, 40);
  doc.text(`Date: ${new Date(invoiceData.invoice_date).toLocaleDateString()}`, 20, 47);

  // Company Details
  doc.setFontSize(9);
  doc.text("From:", 20, 60);
  doc.text(company.name, 20, 67);
  doc.text(company.email || "", 20, 73);

  // Amount Section
  doc.setFontSize(11);
  doc.setFillColor(240, 240, 240);
  doc.rect(20, 100, 170, 40, "F");

  doc.text(`Subtotal: ${invoiceData.currency} ${invoiceData.subtotal.toFixed(2)}`, 30, 110);
  doc.text(
    `Tax (${invoiceData.tax_rate}%): ${invoiceData.currency} ${invoiceData.tax_amount.toFixed(2)}`,
    30,
    120
  );

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text(
    `Total: ${invoiceData.currency} ${invoiceData.amount.toFixed(2)}`,
    30,
    135
  );

  // Footer
  doc.setFontSize(8);
  doc.text(
    "Thank you for your business!",
    doc.internal.pageSize.getWidth() / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  return doc.output("dataurlstring");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      company_id,
      subscription_id,
      amount,
      subtotal,
      currency = "USD",
      tax_country = "AR",
      notes,
    } = await req.json();

    if (!company_id || !amount) {
      return json({ error: "company_id, amount requeridos" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get company
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, email, tax_id")
      .eq("id", company_id)
      .single();

    if (!company) {
      return json({ error: "Compañía no encontrada" }, 404);
    }

    // Get tax rate
    const { data: taxData } = await supabaseAdmin
      .from("tax_rates")
      .select("tax_rate")
      .eq("country_code", tax_country)
      .single();

    const taxRate = taxData?.tax_rate ?? 0;
    const calculatedSubtotal = subtotal ?? amount / (1 + taxRate / 100);
    const calculatedTaxAmount = amount - calculatedSubtotal;

    // Generate invoice number (format: INV-2025-001)
    const year = new Date().getFullYear();
    const { count: invoiceCount } = await supabaseAdmin
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company_id)
      .gte("created_at", `${year}-01-01`);

    const invoiceNumber = `INV-${year}-${String((invoiceCount || 0) + 1).padStart(4, "0")}`;

    // Generate PDF
    const pdfData = await generateInvoicePDF(
      {
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString(),
        amount,
        subtotal: calculatedSubtotal,
        tax_amount: calculatedTaxAmount,
        tax_rate: taxRate,
        currency,
      },
      company
    );

    // TODO: Upload PDF to Supabase Storage or external service
    // For now, we'll store the data URL (in production, upload to S3/CDN)

    // Create invoice record
    const { data: invoice, error: invoiceErr } = await supabaseAdmin
      .from("invoices")
      .insert({
        company_id,
        subscription_id,
        invoice_number,
        invoice_date: new Date().toISOString(),
        amount,
        subtotal: calculatedSubtotal,
        tax_amount: calculatedTaxAmount,
        tax_rate: taxRate,
        tax_country,
        currency,
        status: "issued",
        pdf_url: pdfData, // In production, upload to storage
        notes,
        metadata: {
          generated_at: new Date().toISOString(),
          version: 1,
        },
      })
      .select()
      .single();

    if (invoiceErr) {
      return json({ error: invoiceErr.message }, 500);
    }

    // Update subscription with invoice reference
    if (subscription_id) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          last_invoice_id: invoice.id,
          next_invoice_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          invoice_count: (await supabaseAdmin
            .from("invoices")
            .select("*", { count: "exact", head: true })
            .eq("subscription_id", subscription_id)).count || 0,
        })
        .eq("id", subscription_id);
    }

    return json({
      ok: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        tax_amount: invoice.tax_amount,
        pdf_url: invoice.pdf_url,
      },
    });
  } catch (e) {
    console.error("[generate-invoice] Error:", e);
    return json({ error: String(e) }, 500);
  }
});
