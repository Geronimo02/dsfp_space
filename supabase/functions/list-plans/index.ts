import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Server config error" }, 500);
    }

    const admin = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await admin
      .from("subscription_plans")
      .select("id, name, description, price, billing_period, active")
      .eq("active", true)
      .order("price", { ascending: true });

    if (error) return json({ error: String(error.message ?? error) }, 500);
    return json({ plans: data ?? [] }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
