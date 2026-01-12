import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  companyId?: string;
  emails: string[];
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
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) throw new Error("Unauthorized");

    const { companyId: requestedCompanyId, emails } = (await req.json()) as Body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const baseMembershipQuery = supabaseAdmin
      .from("company_users")
      .select("company_id, role, active")
      .eq("user_id", user.id)
      .or("active.eq.true,active.is.null");

    const { data: membership, error: membershipError } = requestedCompanyId
      ? await baseMembershipQuery.eq("company_id", requestedCompanyId).maybeSingle()
      : await baseMembershipQuery.limit(1).maybeSingle();

    if (membershipError || !membership?.company_id) throw new Error("User is not associated with any company");

    const companyId = membership.company_id as string;
    const isAdmin = membership.role === "admin" || membership.role === "manager";
    if (!isAdmin) throw new Error("Only admins and managers can view roles");

    const normalized = emails
      .map((e) => (e || "").trim().toLowerCase())
      .filter(Boolean);

    const wanted = new Set(normalized);
    const emailToUserId = new Map<string, string>();

    // Fetch users pages until we find all requested emails (or run out)
    let page = 1;
    const perPage = 1000;

    while (emailToUserId.size < wanted.size) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const users = data.users ?? [];
      if (users.length === 0) break;

      for (const u of users as any[]) {
        const em = (u?.email || "").toLowerCase();
        if (em && wanted.has(em)) {
          emailToUserId.set(em, u.id);
        }
      }

      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break; // safety
    }

    const userIds = Array.from(emailToUserId.values());
    let membershipsRows: any[] = [];

    if (userIds.length > 0) {
      const { data: cuData, error: cuError } = await supabaseAdmin
        .from("company_users")
        .select("user_id, role, active")
        .eq("company_id", companyId)
        .in("user_id", userIds);

      if (cuError) throw cuError;
      membershipsRows = cuData || [];
    }

    const roleByUserId = new Map<string, { role: string; active: boolean | null }>();
    for (const row of membershipsRows) {
      roleByUserId.set(row.user_id, { role: row.role, active: row.active ?? null });
    }

    const items = normalized.map((email) => {
      const user_id = emailToUserId.get(email) ?? null;
      const membership = user_id ? roleByUserId.get(user_id) : undefined;
      return {
        email,
        user_id,
        role: membership?.role ?? null,
        active: membership?.active ?? null,
      };
    });

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("company-users-roles error", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
