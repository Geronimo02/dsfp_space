import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthContext = {
  userId: string;
  userEmail: string | null;
  companyId?: string;
  role?: string | null;
};

export function getSupabaseUrl(): string {
  return Deno.env.get("SUPABASE_URL") ?? "";
}

export function getSupabaseAnonKey(): string {
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

export function getSupabaseServiceKey(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

export async function requireAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("No authorization header");

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) throw new Error("Supabase env not configured");

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  return {
    userId: user.id,
    userEmail: user.email ?? null,
  };
}

export async function requireCompanyAccess(req: Request, companyId?: string): Promise<AuthContext> {
  const auth = await requireAuth(req);
  if (!companyId) return auth;

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env not configured");

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabaseAdmin
    .from("company_users")
    .select("role, active")
    .eq("company_id", companyId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error || !data || data.active === false) {
    throw new Error("Forbidden");
  }

  return {
    ...auth,
    companyId,
    role: data.role ?? null,
  };
}
