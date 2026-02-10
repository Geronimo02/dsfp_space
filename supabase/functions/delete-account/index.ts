// supabase/functions/delete-account/index.ts
// Manually delete an account and all associated data

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Restrict CORS to specific domains for security
const ALLOWED_ORIGINS = [
  "https://5670e5fc-c3f6-4b61-9f11-214ae88eb9ef.lovableproject.com",
  "http://localhost:5173"
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
};

function json(payload: unknown, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405, corsHeaders);
    }

    // Get authenticated user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No authorization header" }, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Server config error" }, 500, corsHeaders);
    }

    const admin = createClient(supabaseUrl, supabaseKey);

    // Verify caller identity
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: callerError } = await admin.auth.getUser(token);
    
    if (callerError || !caller) {
      return json({ error: "Unauthorized" }, 401, corsHeaders);
    }

    const { user_id, reason } = await req.json();
    
    if (!user_id) {
      return json({ error: "user_id requerido" }, 400, corsHeaders);
    }

    // Authorization check: user can only delete their own account OR be a platform admin
    const isPlatformAdmin = await (async () => {
      const { data } = await admin
        .from("platform_admins")
        .select("active")
        .eq("user_id", caller.id)
        .eq("active", true)
        .maybeSingle();
      return !!data;
    })();

    const isOwnAccount = caller.id === user_id;

    if (!isOwnAccount && !isPlatformAdmin) {
      return json({ 
        error: "Forbidden: You can only delete your own account" 
      }, 403, corsHeaders);
    }

    // Get user email for logging (with pagination)
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    if (listErr) throw listErr;

    const user = users.find((u: any) => u.id === user_id);
    const userEmail = user?.email ?? "unknown";

    // Get all companies for this user
    const { data: companies, error: companyErr } = await admin
      .from("company_users")
      .select("company_id")
      .eq("user_id", user_id);

    if (companyErr) throw companyErr;

    // Delete each company (cascades delete associated data)
    for (const cu of companies || []) {
      const { error: delErr } = await admin
        .from("companies")
        .delete()
        .eq("id", cu.company_id);
      
      if (delErr) console.error(`Error deleting company ${cu.company_id}:`, delErr);
    }

    // Delete user from auth
    const { error: delUserErr } = await admin.auth.admin.deleteUser(user_id);
    if (delUserErr) throw delUserErr;

    console.log(`Account deleted: ${userEmail} (${user_id}) by ${caller.email} - Reason: ${reason || "manual"}`);

    return json({
      ok: true,
      message: `Cuenta ${userEmail} eliminada completamente`,
    }, 200, corsHeaders);
  } catch (e) {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);
    return json({ error: String(e) }, 500, corsHeaders);
  }
});
