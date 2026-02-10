import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSupabaseServiceKey, getSupabaseUrl, AuthContext } from "./auth.ts";

export type WebhookEvent =
  | "sale.created"
  | "sale.updated"
  | "purchase.created"
  | "purchase.updated"
  | "product.created"
  | "product.updated"
  | "customer.created"
  | "customer.updated"
  | "payment.received"
  | "inventory.alert"
  | "invoice.issued";

export async function triggerWebhook(
  auth: AuthContext,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  if (!auth.companyId) return;

  try {
    const supabase = createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: webhooks, error } = await supabase
      .from("webhooks")
      .select("id, url")
      .eq("company_id", auth.companyId)
      .contains("events", [event])
      .eq("active", true);

    if (error || !webhooks) return;

    for (const webhook of webhooks) {
      // Fire and forget - don't block on webhook delivery
      fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      }).catch(() => {
        // Log silently
      });
    }
  } catch {
    // Silently fail webhook triggers
  }
}

export async function getBulkOperationStatus(
  auth: AuthContext,
  operationId: string
): Promise<{ status: string; progress: number; errors: string[] } | null> {
  const supabase = createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await supabase
    .from("bulk_operations")
    .select("status, total_items, processed_items, errors")
    .eq("id", operationId)
    .eq("company_id", auth.companyId)
    .single();

  if (!data) return null;

  return {
    status: data.status,
    progress: data.total_items > 0 ? (data.processed_items / data.total_items) * 100 : 0,
    errors: data.errors ?? [],
  };
}
