// supabase/functions/check-rate-limit/index.ts
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Rate limits by plan (requests per hour)
const RATE_LIMITS: Record<string, number> = {
  free: 100,
  basic: 1000,
  pro: 10000,
  enterprise: 100000,
};

async function getCompanyPlan(supabaseAdmin: any, companyId: string): Promise<string> {
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("subscription_plans(name)")
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (!subscription?.subscription_plans) {
    return "free"; // Default to free if no active subscription
  }

  const planName = (subscription.subscription_plans as any).name?.toLowerCase() || "free";
  return planName;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const { company_id, endpoint } = await req.json();
    if (!company_id || !endpoint) {
      return json({ error: "company_id y endpoint requeridos" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const supabaseAdmin = createClient(url, serviceRoleKey);

    // Validate user has access to company
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "No autorizado" }, 401);

    const { data: cu } = await supabaseAdmin
      .from("company_users")
      .select("id")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (!cu) return json({ error: "No tienes acceso a esta compañía" }, 403);

    // Get company plan
    const plan = await getCompanyPlan(supabaseAdmin, company_id);
    const limit = RATE_LIMITS[plan] || RATE_LIMITS["free"];

    // Check rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: requestCount } = await supabaseAdmin
      .from("api_requests")
      .select("*", { count: "exact", head: true })
      .eq("company_id", company_id)
      .eq("endpoint", endpoint)
      .gte("created_at", oneHourAgo);

    const currentCount = requestCount || 0;
    const allowed = currentCount < limit;

    // Log request
    if (allowed) {
      await supabaseAdmin.from("api_requests").insert({
        company_id,
        endpoint,
        user_id: user.id,
        allowed: true,
      }).catch(() => {});
    } else {
      await supabaseAdmin.from("api_requests").insert({
        company_id,
        endpoint,
        user_id: user.id,
        allowed: false,
        error_reason: "Rate limit exceeded",
      }).catch(() => {});
    }

    return json({
      allowed,
      current_usage: currentCount,
      limit,
      plan,
      remaining: Math.max(0, limit - currentCount),
      reset_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  } catch (e) {
    console.error("[check-rate-limit] Error:", e);
    return json({ error: String(e) }, 500);
  }
});
