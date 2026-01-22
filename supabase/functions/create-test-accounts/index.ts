// Temporary function to create test accounts - DELETE AFTER USE
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BASIC_PLAN_ID = "ea1d515e-5557-4b5c-a0b1-cd5ea9d13fc0";

const TEST_ACCOUNTS = [
  { email: "testprueba@dsfp.space", password: "Prueba_2026_Ventify", name: "Test Prueba" },
  { email: "pruebatest@dsfp.space", password: "Prueba_Ventify_Prueba2026", name: "Prueba Test" },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: any[] = [];

  for (const account of TEST_ACCOUNTS) {
    try {
      console.log(`Creating account for ${account.email}...`);

      // 1. Create auth user
      const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      });

      if (userErr) {
        // If user exists, find them
        if (userErr.message?.includes("already")) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const existingUser = listData?.users?.find(u => u.email === account.email);
          if (existingUser) {
            // Update password
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              password: account.password,
              email_confirm: true,
            });
            results.push({ email: account.email, status: "user_updated", userId: existingUser.id });
            continue;
          }
        }
        results.push({ email: account.email, status: "user_error", error: userErr.message });
        continue;
      }

      const userId = userData.user?.id;
      if (!userId) {
        results.push({ email: account.email, status: "no_user_id" });
        continue;
      }

      // 2. Create company (minimal fields to avoid trigger issues)
      const { data: company, error: companyErr } = await supabaseAdmin
        .from("companies")
        .insert({
          name: `Empresa ${account.name}`,
          email: account.email,
          active: true,
        })
        .select("id")
        .single();

      if (companyErr) {
        console.error("Company error:", companyErr);
        results.push({ email: account.email, status: "company_error", error: companyErr.message, userId });
        continue;
      }

      const companyId = company.id;

      // 3. Link user to company as admin
      const { error: cuErr } = await supabaseAdmin.from("company_users").insert({
        company_id: companyId,
        user_id: userId,
        role: "admin",
        active: true,
        platform_admin: false,
      });

      if (cuErr && !cuErr.message?.includes("duplicate")) {
        results.push({ email: account.email, status: "company_user_error", error: cuErr.message, userId, companyId });
        continue;
      }

      // 4. Get all available modules
      const { data: allModules } = await supabaseAdmin
        .from("platform_modules")
        .select("id")
        .eq("active", true);

      const moduleIds = allModules?.map(m => m.id) ?? [];

      // 5. Create subscription with all modules
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days trial

      const { error: subErr } = await supabaseAdmin.from("subscriptions").insert({
        company_id: companyId,
        plan_id: BASIC_PLAN_ID,
        provider: "stripe",
        status: "trialing",
        trial_ends_at: trialEndsAt,
        current_period_end: trialEndsAt,
        amount_usd: 0,
        modules: moduleIds,
      });

      if (subErr) {
        results.push({ email: account.email, status: "subscription_error", error: subErr.message, userId, companyId });
        continue;
      }

      // 6. Activate all modules for the company
      for (const moduleId of moduleIds) {
        await supabaseAdmin.from("company_modules").upsert({
          company_id: companyId,
          module_id: moduleId,
          active: true,
          status: "active",
          activated_at: new Date().toISOString(),
        }, { onConflict: "company_id,module_id" });
      }

      results.push({
        email: account.email,
        status: "success",
        userId,
        companyId,
        modulesActivated: moduleIds.length,
      });

    } catch (e) {
      results.push({ email: account.email, status: "exception", error: String(e) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
