import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, getSupabaseUrl, AuthContext } from "./auth.ts";
import { log } from "./logger.ts";

export type AuditAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "export"
  | "login"
  | "logout"
  | "access_denied";

export async function auditLog(
  auth: AuthContext,
  action: AuditAction,
  resource: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabaseUrl = getSupabaseUrl();
    const serviceKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceKey) return;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: auth.userId,
      company_id: auth.companyId ?? null,
      action,
      resource,
      resource_id: resourceId ?? null,
      metadata: metadata ?? {},
    });

    log("info", "audit", { userId: auth.userId, action, resource, resourceId });
  } catch (error) {
    log("error", "audit_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
