import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, password } = await req.json();
    if (!token || !password) throw new Error("token and password required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find token row
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("invite_tokens")
      .select("id, user_id, company_id, expires_at, used")
      .eq("token", token)
      .limit(1)
      .maybeSingle();

    if (tokenError) throw tokenError;
    if (!tokenRow) throw new Error("Token inválido");
    if (tokenRow.used) throw new Error("Token ya utilizado");
    if (new Date(tokenRow.expires_at) < new Date()) throw new Error("Token expirado");

    // Update user password via Admin API - use updateUserById
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(tokenRow.user_id, {
      password,
    });

    if (updateError) throw updateError;

    // Mark token used
    const { error: markError } = await supabaseAdmin
      .from("invite_tokens")
      .update({ used: true })
      .eq("id", tokenRow.id);

    if (markError) console.warn("Could not mark token used", markError);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (err) {
    console.error("consume-invite-token error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
