// supabase/functions/get-subscription-analytics/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(url, serviceRoleKey);

    // Validar que sea platform_admin
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);

    const { data: adminCheck } = await supabaseAdmin
      .from("company_users")
      .select("platform_admin")
      .eq("user_id", user.id)
      .eq("platform_admin", true)
      .maybeSingle();

    if (!adminCheck?.platform_admin) {
      return json({ error: "Solo admins pueden acceder a analytics" }, 403);
    }

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // 1. MRR (Monthly Recurring Revenue)
    const { data: activeSubscriptions } = await supabaseAdmin
      .from("subscriptions")
      .select("*, subscription_plans(price)")
      .eq("status", "active")
      .in("provider", ["stripe", "mercadopago"]);

    const mrr = (activeSubscriptions || []).reduce(
      (sum, sub) => sum + ((sub.subscription_plans as any)?.price || 0),
      0
    );

    // 2. Total Subscriptions
    const { count: totalActive } = await supabaseAdmin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    const { count: totalTrialing } = await supabaseAdmin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "trialing");

    const { count: totalCanceled } = await supabaseAdmin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "canceled")
      .gte("canceled_at", threeMonthsAgo.toISOString());

    // 3. Churn Rate (canceled in last 30 days)
    const { count: churnedLastMonth } = await supabaseAdmin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("status", "canceled")
      .gte("canceled_at", oneMonthAgo.toISOString());

    const churnRate = totalActive ? ((churnedLastMonth || 0) / totalActive) * 100 : 0;

    // 4. Recent Events
    const { data: recentEvents } = await supabaseAdmin
      .from("subscription_events")
      .select("*, companies(name)")
      .order("created_at", { ascending: false })
      .limit(10);

    // 5. At-Risk Subscriptions (payment_failed_count >= 2 or past_due)
    const { data: atRisk } = await supabaseAdmin
      .from("subscriptions")
      .select("id, company_id, companies(name), status, payment_failed_count")
      .or("status.eq.past_due,payment_failed_count.gte.2")
      .limit(20);

    // 6. Trials Expiring Soon (next 7 days)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { data: expiringTrials } = await supabaseAdmin
      .from("subscriptions")
      .select("id, company_id, companies(name), trial_ends_at")
      .eq("status", "trialing")
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", sevenDaysFromNow.toISOString())
      .order("trial_ends_at", { ascending: true });

    // 7. Upgrades/Downgrades (last 30 days)
    const { data: upgrades } = await supabaseAdmin
      .from("subscription_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "upgraded")
      .gte("created_at", oneMonthAgo.toISOString());

    const { data: downgrades } = await supabaseAdmin
      .from("subscription_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "downgraded")
      .gte("created_at", oneMonthAgo.toISOString());

    return json({
      ok: true,
      metrics: {
        mrr: mrr.toFixed(2),
        active_subscriptions: totalActive || 0,
        trialing_subscriptions: totalTrialing || 0,
        canceled_last_90_days: totalCanceled || 0,
        churn_rate_30d: churnRate.toFixed(2),
      },
      alerts: {
        at_risk_count: atRisk?.length || 0,
        at_risk_subscriptions: atRisk || [],
        expiring_trials_count: expiringTrials?.length || 0,
        expiring_trials: expiringTrials || [],
      },
      activity: {
        recent_events: recentEvents || [],
        upgrades_30d: upgrades?.length || 0,
        downgrades_30d: downgrades?.length || 0,
      },
    });
  } catch (e) {
    console.error("[get-subscription-analytics] Error:", e);
    return json({ error: String(e) }, 500);
  }
});
