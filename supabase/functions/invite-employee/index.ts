import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const origin = req.headers.get("origin");
  console.log("invite-employee request", { method: req.method, origin });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, full_name, role, companyId: requestedCompanyId } =
      await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    if (!role) {
      throw new Error("Role is required");
    }

    const baseMembershipQuery = supabaseAdmin
      .from("company_users")
      .select("company_id, role, active")
      .eq("user_id", user.id)
      .or("active.eq.true,active.is.null");

    const { data: companyUser, error: membershipError } = requestedCompanyId
      ? await baseMembershipQuery.eq("company_id", requestedCompanyId).maybeSingle()
      : await baseMembershipQuery.limit(1).maybeSingle();

    if (membershipError || !companyUser?.company_id) {
      console.error("Invite employee: membership not found", {
        user_id: user.id,
        requestedCompanyId,
        membershipError,
      });
      throw new Error("User is not associated with any company");
    }

    const companyId = companyUser.company_id;

    const isAdmin = companyUser.role === "admin" || companyUser.role === "manager";
    if (!isAdmin) {
      throw new Error("Only admins and managers can invite employees");
    }

    // Check if user already exists
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users?.find((u: any) => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Check if already in company
      const { data: existingCompanyUser, error: existingCompanyUserError } =
        await supabaseAdmin
          .from("company_users")
          .select("id")
          .eq("user_id", userId)
          .eq("company_id", companyId)
          .limit(1)
          .maybeSingle();

      if (existingCompanyUserError) {
        console.error("Error checking existing company user", existingCompanyUserError);
        throw existingCompanyUserError;
      }

      if (existingCompanyUser) {
        return new Response(
          JSON.stringify({
            success: true,
            already_member: true,
            user_id: userId,
            message: "El usuario ya pertenece a esta empresa",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      // Add existing user to company
      const { error: companyUserError } = await supabaseAdmin
        .from("company_users")
        .insert({
          user_id: userId,
          company_id: companyId,
          role: role,
          active: true,
        });

      if (companyUserError) throw companyUserError;

      return new Response(
        JSON.stringify({
          success: true,
          user_id: userId,
          email_sent: false,
          message: "Usuario agregado a la empresa (ya tenía cuenta)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // User doesn't exist - use inviteUserByEmail which sends email via Supabase SMTP
    const configuredFrontendUrl = Deno.env.get("FRONTEND_URL");
    const rawFrontendUrl = configuredFrontendUrl || origin || "";

    const normalizeFrontendUrl = (value: string) => {
      const v = (value || "").trim();
      if (!v) return "";
      const withoutTrailingSlash = v.replace(/\/+$/, "");
      if (withoutTrailingSlash.startsWith("http://") || withoutTrailingSlash.startsWith("https://")) {
        return withoutTrailingSlash;
      }
      // If someone configured only the domain (without scheme), force https.
      return `https://${withoutTrailingSlash}`;
    };

    const frontendUrl = normalizeFrontendUrl(rawFrontendUrl);
    if (!frontendUrl) {
      throw new Error(
        "FRONTEND_URL no está configurado y no se recibió el header Origin; no puedo construir redirectTo"
      );
    }

    const redirectTo = new URL("/auth", frontendUrl).toString();


    console.log("Inviting new user via Supabase Auth", { email, redirectTo });

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        full_name: full_name || "",
        invited_to_company: companyId,
        assigned_role: role,
      },
    });

    if (inviteError) {
      console.error("Error inviting user:", inviteError);
      throw inviteError;
    }

    if (!inviteData.user) {
      throw new Error("No se pudo crear el usuario");
    }

    userId = inviteData.user.id;
    console.log("User invited successfully", { userId, email });

    // Create company_users entry for new user
    const { error: insertCompanyUserError } = await supabaseAdmin
      .from("company_users")
      .insert({
        user_id: userId,
        company_id: companyId,
        role: role,
        active: true,
      });

    if (insertCompanyUserError) {
      console.error("Error creating company_users entry:", insertCompanyUserError);
      throw insertCompanyUserError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email_sent: true,
        message: "Invitación enviada. El usuario recibirá un email para configurar su contraseña.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("invite-employee error", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
