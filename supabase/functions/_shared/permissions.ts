import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, getSupabaseUrl, AuthContext } from "./auth.ts";

export type Permission = "view" | "create" | "edit" | "delete" | "export";
export type Module = string;

const PERMISSIONS_CACHE = new Map<string, { permissions: any[]; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function hasPermission(
  auth: AuthContext,
  module: Module,
  permission: Permission
): Promise<boolean> {
  if (!auth.companyId || !auth.role) return false;

  const cacheKey = `${auth.companyId}:${auth.role}`;
  const cached = PERMISSIONS_CACHE.get(cacheKey);
  const now = Date.now();

  let permissions: any[];

  if (cached && cached.expires > now) {
    permissions = cached.permissions;
  } else {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase env not configured");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabaseAdmin
      .from("role_permissions")
      .select("*")
      .eq("company_id", auth.companyId)
      .eq("role", auth.role);

    if (error) throw error;
    permissions = data ?? [];
    PERMISSIONS_CACHE.set(cacheKey, { permissions, expires: now + CACHE_TTL });
  }

  // Admin always has full permissions
  if (auth.role === "admin") return true;

  const perm = permissions.find((p) => p.module === module);
  if (!perm) return false;

  switch (permission) {
    case "view":
      return perm.can_view === true;
    case "create":
      return perm.can_create === true;
    case "edit":
      return perm.can_edit === true;
    case "delete":
      return perm.can_delete === true;
    case "export":
      return perm.can_export === true;
    default:
      return false;
  }
}

export async function requirePermission(
  auth: AuthContext,
  module: Module,
  permission: Permission
): Promise<void> {
  const allowed = await hasPermission(auth, module, permission);
  if (!allowed) {
    throw new Error(`Forbidden: requires ${permission} permission on ${module}`);
  }
}
