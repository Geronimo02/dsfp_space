import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to specific domains for security
const ALLOWED_ORIGINS = [
  "https://5670e5fc-c3f6-4b61-9f11-214ae88eb9ef.lovableproject.com",
  "https://preview--dsfp-space.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://dsfp-space.vercel.app",
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
};

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    // Verify the user is authenticated
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

    // Get email and role from request (prefer the company selected in the UI)
    const { email, full_name, role, companyId: requestedCompanyId } =
      await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    if (!role) {
      throw new Error("Role is required");
    }

    // Verify membership + permissions in the target company
    const baseMembershipQuery = supabaseAdmin
      .from("company_users")
      .select("company_id, role, active")
      .eq("user_id", user.id)
      // Treat NULL as active (legacy rows)
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

    // Check if user has admin or manager role in this company
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
      // User already exists - just add to company
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
        // Idempotent response: not an error
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

      // Add user to company
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
          message: "Usuario agregado a la empresa",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // User doesn't exist - create them directly with auto-confirm
    const tempPassword = crypto.randomUUID();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || "",
        invited_to_company: companyId,
        assigned_role: role,
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error("No se pudo crear el usuario");

    userId = data.user.id;

    // Send password reset email so user can set their password
    // NOTE: admin.generateLink only generates the link; it does not send an email.
    const redirectTo = `${req.headers.get("origin") || "https://5670e5fc-c3f6-4b61-9f11-214ae88eb9ef.lovableproject.com"}/reset-password`;

    const { data: resetData, error: resetError } =
      await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

    console.log("Password reset email requested", { email, redirectTo, resetData });
    if (resetError) console.error("Error requesting password reset email:", resetError);

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
        message:
          "Usuario invitado. Se le ha enviado un email para configurar su contraseña",
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
