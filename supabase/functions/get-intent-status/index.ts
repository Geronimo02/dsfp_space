// supabase/functions/get-intent-status/index.ts
// Get signup intent status using service role

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405);
    }

    const { intent_id } = await req.json();
    if (!intent_id) {
      return json({ error: "intent_id requerido" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Server config error" }, 500);
    }

    const admin = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await admin
      .from("signup_intents")
      .select("status")
      .eq("id", intent_id)
      .single();

    if (error) {
      return json({ error: String(error.message ?? error) }, 500);
    }

    return json({ status: data?.status }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
