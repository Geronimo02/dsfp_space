// supabase/functions/delete-account/index.ts
// Manually delete an account and all associated data

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Only POST allowed" }, 405);
    }

    const { user_id, reason } = await req.json();
    
    if (!user_id) {
      return json({ error: "user_id requerido" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: "Server config error" }, 500);
    }

    const admin = createClient(supabaseUrl, supabaseKey);

    // Get user email for logging
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
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

    console.log(`Account deleted: ${userEmail} (${user_id}) - Reason: ${reason || "manual"}`);

    return json({
      ok: true,
      message: `Cuenta ${userEmail} eliminada completamente`,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
