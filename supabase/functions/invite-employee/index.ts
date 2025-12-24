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

    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users?.find((u: any) => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

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

    // User doesn't exist - create them with auto-confirm
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

    const frontendUrl = Deno.env.get("FRONTEND_URL") || req.headers.get("origin") || "";

    // Create a single-use invite token for setting password
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

    // Try to send custom email via company SMTP/SendGrid
    let emailSent = false;
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
        const setPasswordLink = inviteToken ? `${frontendUrl}/set-password/${inviteToken}` : `${frontendUrl}/auth`;
        const html = `
          <p>Hola ${full_name || ""},</p>
          <p>Has sido invitado a la empresa. Tu usuario es <strong>${email}</strong>.</p>
          <p>Para configurar tu contraseña y acceder, haz clic en el siguiente enlace:</p>
          <p><a href="${setPasswordLink}">${setPasswordLink}</a></p>
          <p>Si el enlace expira, contacta al administrador de la empresa.</p>
        `;

        if (cfg.provider === "sendgrid" && cfg.apiKey) {
          try {
            const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
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
            if (response.ok) {
              emailSent = true;
              console.log("Invitation email sent via SendGrid to", email);
            } else {
              console.error("SendGrid error", await response.text());
            }
          } catch (err) {
            console.error("Error sending invite via SendGrid", err);
          }
        } else if (cfg.provider === "resend" && cfg.apiKey) {
          try {
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${cfg.apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: cfg.from || "onboarding@resend.dev",
                to: [email],
                subject: "Invitación a la empresa",
                html: html,
              }),
            });
            if (response.ok) {
              emailSent = true;
              console.log("Invitation email sent via Resend to", email);
            } else {
              console.error("Resend error", await response.text());
            }
          } catch (err) {
            console.error("Error sending invite via Resend", err);
          }
        } else {
          console.log("No supported company email provider found");
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

    const setPasswordLink = inviteToken ? `${frontendUrl}/set-password/${inviteToken}` : null;

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        email_sent: emailSent,
        set_password_link: setPasswordLink,
        message: emailSent
          ? "Usuario invitado. Se le ha enviado un email para configurar su contraseña"
          : "Usuario creado. Comparte este enlace para que configure su contraseña: " + setPasswordLink,
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
