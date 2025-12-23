import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to specific domains for security
const ALLOWED_ORIGINS = [
  "https://5670e5fc-c3f6-4b61-9f11-214ae88eb9ef.lovableproject.com",
  "https://preview--dsfp-space.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "https://dsfp-space.vercel.app"
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

    // Verify the user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get company_id from company_users table
    const { data: companyUser } = await supabaseAdmin
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("active", true)
      .single();

    if (!companyUser || !companyUser.company_id) {
      throw new Error("User is not associated with any company");
    }

    const companyId = companyUser.company_id;

    // Check if user has admin or manager role in this company
    const isAdmin = companyUser.role === "admin" || companyUser.role === "manager";
    if (!isAdmin) {
      throw new Error("Only admins and managers can invite employees");
    }

    // Get email and role from request
    const { email, full_name, role } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    if (!role) {
      throw new Error("Role is required");
    }

    // Check if user already exists
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.find((u: any) => u.email === email);

    let userId: string;

    if (existingUser) {
      // User already exists - just add to company
      userId = existingUser.id;
      
      // Check if already in company
      const { data: existingCompanyUser } = await supabaseAdmin
        .from("company_users")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", companyId)
        .single();

      if (existingCompanyUser) {
        throw new Error("El usuario ya pertenece a esta empresa");
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

    } else {
      // User doesn't exist - create them directly with auto-confirm
      const tempPassword = crypto.randomUUID();
      
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
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
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: `${req.headers.get("origin") || "https://5670e5fc-c3f6-4b61-9f11-214ae88eb9ef.lovableproject.com"}/reset-password`,
        }
      });
      
      if (resetError) console.error("Error sending password reset:", resetError);

      // Create company_users entry for new user
      const { error: companyUserError } = await supabaseAdmin
        .from("company_users")
        .insert({
          user_id: userId,
          company_id: companyId,
          role: role,
          active: true,
        });

      if (companyUserError) {
        console.error("Error creating company_users entry:", companyUserError);
        throw companyUserError;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: userId,
      message: existingUser ? "Usuario agregado a la empresa" : "Usuario invitado. Se le ha enviado un email para configurar su contraseña"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
