// Cron job to charge subscriptions after 7-day trial ends
// Run daily to check and charge users with expired trials

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { corsHeaders } from "../_shared/cors.ts";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Server config error" }, 500);
    }

    const admin = createClient(supabaseUrl, supabaseKey);

    // Find intents where trial_ends_at <= now and status = 'completed' (active trial)
    // and payment_failed_at is null (hasn't failed yet)
    const { data: expiredTrials, error: queryErr } = await admin
      .from("signup_intents")
      .select("id, email, provider, billing_plan_id, modules, amount_ars, fx_rate_usd_ars, company_id")
      .eq("status", "completed")
      .is("payment_failed_at", null)
      .lte("trial_ends_at", new Date().toISOString())
      .limit(50);

    if (queryErr) throw queryErr;

    const results: any[] = [];

    for (const intent of expiredTrials || []) {
      try {
        // Attempt to charge the billing plan
        const chargeResult = await attemptCharge(admin, intent);
        
        if (chargeResult.success) {
          // Mark as successfully charged
          await admin
            .from("signup_intents")
            .update({ status: "subscription_active" })
            .eq("id", intent.id);
          
          results.push({
            intent_id: intent.id,
            status: "charged",
          });
        } else {
          // Mark as failed and send email
          const { error: updateErr } = await admin
            .from("signup_intents")
            .update({ 
              payment_failed_at: new Date().toISOString(),
              status: "payment_failed"
            })
            .eq("id", intent.id);

          if (!updateErr) {
            // Send payment failure email
            await sendPaymentFailureEmail(admin, intent.email);
          }

          results.push({
            intent_id: intent.id,
            status: "payment_failed",
            error: chargeResult.error,
          });
        }
      } catch (e) {
        console.error(`Error processing intent ${intent.id}:`, e);
        results.push({
          intent_id: intent.id,
          status: "error",
          error: String(e),
        });
      }
    }

    // Check for intents that failed 2+ days ago and delete them
    await deleteExpiredFailedAccounts(admin);

    return json({
      processed: results.length,
      results,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

async function attemptCharge(
  admin: any,
  intent: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");

    if (intent.provider === "stripe") {
      if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");

      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

      // Get subscription from table
      const { data: subscription } = await admin
        .from("subscriptions")
        .select("*")
        .eq("company_id", intent.company_id)
        .eq("provider", "stripe")
        .single();

      if (!subscription?.provider_customer_id) {
        throw new Error("Stripe customer ID not found");
      }

      // Create invoice for trial-ending charge
      const invoice = await stripe.invoices.create({
        customer: subscription.provider_customer_id,
        auto_advance: true,
      });

      console.log(`Stripe charge created: invoice ${invoice.id}`);
      return { success: true };
    } else if (intent.provider === "mercadopago") {
      if (!mpToken) throw new Error("MP_ACCESS_TOKEN missing");

      // Get subscription from table
      const { data: subscription } = await admin
        .from("subscriptions")
        .select("*")
        .eq("company_id", intent.company_id)
        .eq("provider", "mercadopago")
        .single();

      if (!subscription?.provider_subscription_id) {
        throw new Error("MercadoPago preapproval ID not found");
      }

      // Get the plan price to charge (from subscription which has the actual plan being billed)
      const { data: planData } = await admin
        .from("subscription_plans")
        .select("price")
        .eq("id", subscription.plan_id)
        .single();

      const basePriceUsd = Number(planData?.price || 0);
      const modulesPrice = (subscription.modules?.length || 0) * 10;
      const totalUsd = basePriceUsd + modulesPrice;

      // Use the FX rate from subscription or a fixed rate
      const fxRate = subscription.fx_rate_usd_ars || 1000;
      const amount_ars = Math.round(totalUsd * fxRate * 100); // Convert to cents

      if (amount_ars <= 0) {
        throw new Error(`Invalid amount for charging: ${amount_ars} (USD: ${totalUsd}, FX: ${fxRate})`);
      }

      const paymentRes = await fetch(
        "https://api.mercadopago.com/authorized_payments",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mpToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            preapproval_id: subscription.provider_subscription_id,
            amount: amount_ars / 100, // Convert cents to currency
            reference_id: `trial-${intent.id}-${Date.now()}`,
            description: `Cobro después del período de prueba - Plan ${planData?.name || "básico"}`,
          }),
        }
      );

      if (!paymentRes.ok) {
        const errorData = await paymentRes.json();
        throw new Error(
          `MercadoPago error: ${errorData.message || paymentRes.statusText}`
        );
      }

      const paymentData = await paymentRes.json();
      console.log(`MercadoPago charge created: payment ${paymentData.id}`);
      return { success: true };
    }

    throw new Error(`Unknown provider: ${intent.provider}`);
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function sendPaymentFailureEmail(admin: any, email: string) {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log(`Skipping email to ${email} - RESEND_API_KEY not configured`);
      return;
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@retailsnappro.com",
        to: email,
        subject: "⚠️ Fallo de pago - Tienes 2 días para pagar",
        html: `
          <h2>Aviso importante</h2>
          <p>El cobro automático al finalizar tu período de prueba ha fallado.</p>
          <p><strong>Tienes 2 días para resolver el pago.</strong></p>
          <p>Si no actualizas tu método de pago en 2 días, tu cuenta será eliminada completamente.</p>
          <p>Por favor, accede a tu cuenta y actualiza tu información de pago lo antes posible.</p>
          <p>Si tienes problemas, contáctanos al soporte.</p>
          <p>Gracias,<br>El equipo de RetailSnap Pro</p>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json();
      console.error(`Resend error: ${errData.message}`);
    } else {
      console.log(`Payment failure email sent to ${email}`);
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function deleteExpiredFailedAccounts(admin: any) {
  try {
    // Find intents that failed 2+ days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: expiredFailed, error: queryErr } = await admin
      .from("signup_intents")
      .select("id, company_id, email")
      .eq("status", "payment_failed")
      .lte("payment_failed_at", twoDaysAgo);

    if (queryErr) throw queryErr;

    for (const intent of expiredFailed || []) {
      try {
        // Delete account completely
        await deleteAccount(admin, intent.company_id, intent.email);
        
        // Mark intent as deleted
        await admin
          .from("signup_intents")
          .update({ status: "deleted" })
          .eq("id", intent.id);
      } catch (e) {
        console.error(`Error deleting account for ${intent.email}:`, e);
      }
    }
  } catch (error) {
    console.error("Error in deleteExpiredFailedAccounts:", error);
  }
}

async function deleteAccount(admin: any, companyId: string, email: string) {
  try {
    // Get the user ID from auth
    const { data: { users }, error: userErr } = await admin.auth.admin.listUsers();
    if (userErr) throw userErr;
    
    const user = users.find((u: any) => u.email === email);
    if (!user) return;

    // Delete user from auth
    await admin.auth.admin.deleteUser(user.id);

    // Delete company data (cascades via FK constraints)
    if (companyId) {
      await admin.from("companies").delete().eq("id", companyId);
    }

    console.log(`Account deleted for ${email}`);
  } catch (error) {
    console.error(`Error deleting account for ${email}:`, error);
    throw error;
  }
}
