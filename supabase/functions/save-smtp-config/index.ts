import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    // Verify membership + admin/manager role
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role, active")
      .eq("user_id", user.id)
      .or("active.eq.true,active.is.null")
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership?.company_id) throw new Error("User has no company membership");
    const isAdmin = membership.role === "admin" || membership.role === "manager";
    if (!isAdmin) throw new Error("Only admins/managers can change email settings");

    const body = await req.json();
    const { smtp } = body;
    if (!smtp) throw new Error("smtp payload required");

    const companyId = membership.company_id;

    // Upsert into company_settings
    const { error: upsertError } = await supabaseAdmin
      .from("company_settings")
      .upsert({ company_id: companyId, key: "smtp", value: smtp }, { onConflict: ["company_id", "key"] });

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("save-smtp-config error", error);
    return new Response(JSON.stringify({ error: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
