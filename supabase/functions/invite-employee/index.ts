import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers (Edge Functions are called from browsers; use wildcard to avoid preview-domain mismatches)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
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

    // Generate a recovery link (preferred) so we can send a custom invite email.
    const redirectTo = `${Deno.env.get("FRONTEND_URL") || req.headers.get("origin") || ""}/reset-password`;

    let actionLink: string | null = null;

    try {
      // Try to generate a recovery link with admin privileges (does not send email)
      // Note: Supabase admin API may return the action link in different shapes; try common fields.
      const { data: linkData, error: linkError } = await (supabaseAdmin.auth as any).admin.generateLink?.({ type: "recovery", email, redirectTo }) || { data: null, error: new Error("generateLink not available") };
      if (!linkError && linkData) {
        actionLink = linkData.action_link || linkData.actionLink || linkData.link || null;
      }
    } catch (err) {
      console.warn("generateLink not available or failed, will fallback to resetPasswordForEmail", err);
    }

    // Fallback: request Supabase to send reset email (if generateLink not available)
    let resetData: any = null;
    if (!actionLink) {
      try {
        const res = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
        resetData = res.data;
        // Some Supabase setups return the action link in the response
        actionLink = res.data?.action_link || res.data?.link || null;
        console.log("Password reset email requested (fallback)", { email, redirectTo, resetData });
      } catch (err) {
        console.error("Error requesting password reset email (fallback):", err);
      }
    }

    // Create a single-use invite token and include a link to set password without fragment
    let inviteToken: string | null = null;
    try {
      inviteToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(); // 3 days
      const { error: tokenErr } = await supabaseAdmin
        .from("invite_tokens")
        .insert({ token: inviteToken, user_id: userId, company_id: companyId, expires_at: expiresAt });
      if (tokenErr) {
        console.error("Error creating invite token", tokenErr);
        inviteToken = null;
      }
    } catch (err) {
      console.error("Error creating invite token", err);
      inviteToken = null;
    }

    // Try to fetch company-specific SMTP/SendGrid config to also send a custom invitation email
    try {
      const { data: smtpRow, error: smtpError } = await supabaseAdmin
        .from("company_settings")
        .select("value")
        .eq("company_id", companyId)
        .eq("key", "smtp")
        .limit(1)
        .maybeSingle();

      if (!smtpError && smtpRow?.value) {
        const cfg = smtpRow.value as any;
        const frontendUrl = Deno.env.get("FRONTEND_URL") || req.headers.get("origin") || "";

        // Compose a simple HTML invitation including the temporary password and a link to login/reset
        const loginLink = `${frontendUrl}/auth`;
        const setPasswordLink = inviteToken ? `${frontendUrl}/set-password/${inviteToken}` : (actionLink || loginLink);
        const html = `
          <p>Hola ${full_name || ""},</p>
          <p>Has sido invitado a la empresa. Tu usuario es <strong>${email}</strong>.</p>
          <p>Para configurar tu contraseña y acceder, haz clic en el siguiente enlace:</p>
          <p><a href="${setPasswordLink}">${setPasswordLink}</a></p>
          <p>Si el enlace expira, contacta al administrador de la empresa.</p>
        `;

        if (cfg.provider === "sendgrid" && cfg.apiKey) {
          try {
            await fetch("https://api.sendgrid.com/v3/mail/send", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cfg.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                personalizations: [{ to: [{ email }], subject: "Invitación a la empresa" }],
                from: { email: cfg.from || "no-reply@yourapp.com" },
                content: [{ type: "text/html", value: html }],
              }),
            });
            console.log("Invitation email sent via SendGrid to", email);
          } catch (err) {
            console.error("Error sending invite via SendGrid", err);
          }
        } else if (cfg.provider === "smtp") {
          // Send via company SMTP using deno smtp client
          try {
            const { SmtpClient } = await import("https://deno.land/x/smtp/mod.ts");
            const client = new SmtpClient();
            await client.connect({
              hostname: cfg.host,
              port: Number(cfg.port) || 587,
              username: cfg.user,
              password: cfg.password,
              tls: cfg.secure === true || cfg.secure === "true",
            });
            await client.send({
              from: cfg.from || "no-reply@yourapp.com",
              to: email,
              subject: "Invitación a la empresa",
              content: html,
            });
            await client.close();
            console.log("Invitation email sent via SMTP to", email);
          } catch (err) {
            console.error("Error sending invite via SMTP", err);
          }
        } else {
          console.log("No supported company email provider found; rely on project's reset email or SendGrid");
        }
      }
    } catch (err) {
      console.error("Error fetching company SMTP config:", err);
    }

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
